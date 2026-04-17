/**
 * @author Jingyun Studio
 * @copyright 2026 Jingyun Studio
 * @license MIT
 */

import fs from "node:fs";
import path from "node:path";
import { CommandResult, runCommand, runCommandWithStream, sleep } from "./command";
import { log } from "./logger";
import { DockerInstaller, ProgressCallback } from "./docker-installer";
import { maskImageUrl } from "./image-mask";
import { cleanDockerOutput } from "./docker-output";

export interface PullImageResult {
  success: boolean;
  image?: string;
  message: string;
}

export interface LoadImageResult {
  success: boolean;
  image?: string;
  message: string;
}

function summarizeError(stderr: string, stdout: string): string {
  const raw = (stderr || stdout || "unknown error").trim();
  return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
}

export class DockerManager {
  private readonly installer: DockerInstaller;
  private downloadProgressCallback?: ProgressCallback;

  constructor() {
    this.installer = new DockerInstaller();
  }

  setDownloadProgressCallback(callback: ProgressCallback): void {
    this.downloadProgressCallback = callback;
  }

  async getVersion(): Promise<CommandResult> {
    return runCommand("docker", ["--version"]);
  }

  async isInstalled(): Promise<boolean> {
    const result = await this.getVersion();
    return result.code === 0;
  }

  async isDaemonReady(): Promise<boolean> {
    const result = await runCommand("docker", ["info"]);
    return result.code === 0;
  }

  async ensureReady(autoInstall = true): Promise<{ success: boolean; message: string; errorCode?: string; needsRestart?: boolean }> {
    // 检查是否已安装
    if (!(await this.isInstalled())) {
      if (!autoInstall) {
        return {
          success: false,
          message: "未检测到 Docker，请先安装 Docker Desktop。",
          errorCode: "docker_not_found",
        };
      }

      // 自动安装 Docker Desktop
      log("未检测到 Docker，开始自动安装");
      const downloadDir = path.join(process.env.TEMP || "C:\\Temp", "hermes-docker-installer");
      const installResult = await this.installer.autoInstall(downloadDir, this.downloadProgressCallback);

      if (!installResult.success) {
        return {
          success: false,
          message: `Docker 自动安装失败: ${installResult.message}`,
          errorCode: installResult.errorCode || "auto_install_failed",
        };
      }

      if (installResult.needsRestart) {
        return {
          success: false,
          message: installResult.message,
          errorCode: "needs_system_restart",
          needsRestart: true,
        };
      }

      log("Docker 自动安装完成");
    }

    // 检查 Docker 服务是否就绪
    if (!(await this.isDaemonReady())) {
      log("Docker 服务未就绪，尝试启动");

      // 尝试启动 Docker Desktop
      const startResult = await this.installer.startDockerDesktop();
      if (startResult.success) {
        // 等待 Docker 就绪
        const readyResult = await this.installer.waitForDockerReady();
        if (readyResult.success) {
          return {
            success: true,
            message: "Docker Desktop 已启动并就绪。",
          };
        }
      }

      return {
        success: false,
        message: "Docker 已安装但服务未就绪，请手动启动 Docker Desktop 后重试。",
        errorCode: "docker_daemon_not_ready",
      };
    }

    return {
      success: true,
      message: "Docker 环境可用。",
    };
  }

  async containerExists(name: string): Promise<boolean> {
    const result = await runCommand("docker", [
      "ps",
      "-a",
      "--filter",
      `name=${name}`,
      "--format",
      "{{.Names}}",
    ]);

    if (result.code !== 0) {
      return false;
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(name);
  }

  async createVolume(name: string): Promise<CommandResult> {
    // 先检查 volume 是否已存在
    const checkResult = await runCommand("docker", ["volume", "inspect", name]);
    if (checkResult.code === 0) {
      log(`Volume ${name} 已存在`);
      return { code: 0, stdout: "", stderr: "" };
    }

    log(`创建 volume: ${name}`);
    return runCommand("docker", ["volume", "create", name]);
  }

  async imageExists(image: string): Promise<boolean> {
    const result = await runCommand("docker", ["image", "inspect", image]);
    return result.code === 0;
  }

  async pullWithRetryCandidates(candidateImages: string[], retriesPerSource = 2): Promise<PullImageResult> {
    const uniqueCandidates = Array.from(new Set(candidateImages.filter(Boolean)));
    const errors: string[] = [];

    log(`开始拉取镜像，共 ${uniqueCandidates.length} 个候选源`);

    for (const image of uniqueCandidates) {
      log(`检查本地镜像: ${maskImageUrl(image)}`);
      if (await this.imageExists(image)) {
        log(`使用本地镜像: ${maskImageUrl(image)}`);
        return {
          success: true,
          image,
          message: `使用本地镜像 ${maskImageUrl(image)}`,
        };
      }

      log(`本地镜像不存在，开始拉取: ${maskImageUrl(image)}`);
      for (let attempt = 1; attempt <= retriesPerSource; attempt += 1) {
        log(`拉取尝试 ${attempt}/${retriesPerSource}: ${maskImageUrl(image)}`);

        // 使用实时流输出，显示 Docker 原生的拉取进度
        // 注意：docker pull 的进度输出在 stderr，不是 stdout
        // 使用 --progress=plain 强制输出进度（即使在非 TTY 环境）
        const pullResult = await runCommandWithStream(
          "docker",
          ["pull", "--progress=plain", image],
          (data) => {
            // stdout 输出
            const cleaned = cleanDockerOutput(data);
            const trimmed = cleaned.trim();
            if (trimmed) {
              log(trimmed);
            }
          },
          (data) => {
            // stderr 输出（docker pull 的进度在这里）
            const cleaned = cleanDockerOutput(data);
            const trimmed = cleaned.trim();
            if (trimmed) {
              log(trimmed);
            }
          },
          1800000, // 1800s timeout (30分钟，适应极慢的网络环境)
        );

        if (pullResult.code === 0) {
          log(`镜像拉取成功: ${maskImageUrl(image)}`);
          return {
            success: true,
            image,
            message: `镜像拉取成功: ${maskImageUrl(image)}`,
          };
        }

        const errorMsg = summarizeError(pullResult.stderr, pullResult.stdout);
        log(`拉取失败 (attempt ${attempt}): ${errorMsg}`);
        errors.push(`${maskImageUrl(image)} (attempt ${attempt}/${retriesPerSource}): ${errorMsg}`);

        // 如果是网络错误或超时，快速切换到下一个源，不再重试当前源
        const errorMsgLower = (pullResult.stderr || pullResult.stdout || "").toLowerCase();
        if (errorMsgLower.includes("timeout") || errorMsgLower.includes("connection") || errorMsgLower.includes("network")) {
          log("检测到网络错误，跳过当前源的剩余重试");
          break; // 跳过当前源的剩余重试
        }

        if (attempt < retriesPerSource) {
          const waitTime = 800 * attempt;
          log(`等待 ${waitTime}ms 后重试...`);
          await sleep(waitTime); // 减少等待时间
        }
      }
    }

    log("所有镜像源拉取失败");
    return {
      success: false,
      message: `镜像拉取失败。已尝试 ${uniqueCandidates.length} 个源。建议：1) 使用离线安装包 2) 配置 Docker 镜像加速器 3) 检查网络连接。最后错误：${errors.slice(-3).join(" | ")}`,
    };
  }

  async loadFromTarCandidates(candidateImages: string[], tarPaths: string[]): Promise<LoadImageResult> {
    const uniqueImages = Array.from(new Set(candidateImages.filter(Boolean)));
    const uniqueTarPaths = Array.from(new Set(tarPaths.filter(Boolean)));

    for (const image of uniqueImages) {
      if (await this.imageExists(image)) {
        return {
          success: true,
          image,
          message: `使用本地镜像 ${image}`,
        };
      }
    }

    for (const tarPath of uniqueTarPaths) {
      if (!fs.existsSync(tarPath)) {
        continue;
      }

      const loadResult = await runCommand("docker", ["load", "-i", tarPath]);
      if (loadResult.code !== 0) {
        continue;
      }

      for (const image of uniqueImages) {
        if (await this.imageExists(image)) {
          return {
            success: true,
            image,
            message: `已从离线镜像包导入: ${tarPath}`,
          };
        }
      }
    }

    return {
      success: false,
      message: `离线镜像导入失败。未找到可用镜像包或导入后镜像标签不匹配。候选路径: ${uniqueTarPaths.join(" | ") || "none"}`,
    };
  }

  async startContainer(name: string): Promise<CommandResult> {
    return runCommand("docker", ["start", name]);
  }

  async runDetached(args: string[]): Promise<CommandResult> {
    return runCommand("docker", ["run", "-d", ...args]);
  }
}
