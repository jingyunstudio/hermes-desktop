import path from "node:path";
import { AppSettings, OperationResult } from "@hermes-desktop/shared-types";
import { DockerComposeManager } from "./compose";
import { DockerManager } from "./docker";
import { isUrlReachable } from "./http";
import { sleep } from "./command";
import { log } from "./logger";

export class HermesComposeManager {
  private readonly compose: DockerComposeManager;

  constructor(
    private readonly docker: DockerManager,
    private readonly settings: AppSettings,
    composeFilePath: string,
  ) {
    this.compose = new DockerComposeManager(composeFilePath, "hermes-desktop");
  }

  async ensureInstalledAndRunning(): Promise<OperationResult> {
    log("开始使用 Docker Compose 部署 Hermes 服务...");

    // 检查服务是否已在运行
    if (await isUrlReachable(`${this.settings.hermesApiUrl.replace(/\/$/, "")}/health`)) {
      log("Hermes 服务已在运行");
      return {
        success: true,
        message: "Hermes 服务已在运行。",
      };
    }

    // 创建 volumes（如果不存在）
    log("确保 Docker volumes 存在...");
    await this.docker.createVolume("hermes-desktop-runtime-data");
    await this.docker.createVolume("hermes-desktop-webui-data");

    // 拉取镜像
    log("拉取 Docker 镜像...");
    const pullResult = await this.compose.pull();
    if (pullResult.code !== 0) {
      log(`镜像拉取失败: ${pullResult.stderr || pullResult.stdout}`);
      return {
        success: false,
        message: `镜像拉取失败: ${pullResult.stderr || pullResult.stdout || "unknown error"}`,
        errorCode: "compose_pull_failed",
      };
    }

    // 启动服务
    log("启动 Hermes 和 Open WebUI 服务...");
    const upResult = await this.compose.up();
    if (upResult.code !== 0) {
      log(`服务启动失败: ${upResult.stderr || upResult.stdout}`);
      return {
        success: false,
        message: `服务启动失败: ${upResult.stderr || upResult.stdout || "unknown error"}`,
        errorCode: "compose_up_failed",
      };
    }

    // 等待 Hermes 服务就绪
    log("等待 Hermes 服务健康检查（最多 120 秒）...");
    for (let i = 0; i < 80; i += 1) {
      const healthUrl = `${this.settings.hermesApiUrl.replace(/\/$/, "")}/health`;
      if (await isUrlReachable(healthUrl, { timeoutMs: 3000 })) {
        log(`Hermes 服务就绪（第 ${i + 1} 次检查）`);
        break;
      }

      log(`等待 Hermes 服务就绪... (${i + 1}/80)`);
      await sleep(1500);

      if (i === 79) {
        log("Hermes 服务启动超时");
        return {
          success: false,
          message: "Hermes 服务启动超时。",
          errorCode: "hermes_start_timeout",
        };
      }
    }

    // 等待 Open WebUI 服务就绪
    log("等待 Open WebUI 服务健康检查（最多 90 秒）...");
    for (let i = 0; i < 60; i += 1) {
      if (await isUrlReachable(this.settings.openWebuiUrl)) {
        log(`Open WebUI 服务就绪（第 ${i + 1} 次检查）`);
        return {
          success: true,
          message: "Hermes 和 Open WebUI 服务启动成功。",
        };
      }

      log(`等待 Open WebUI 服务就绪... (${i + 1}/60)`);
      await sleep(1500);
    }

    log("Open WebUI 服务启动超时");
    return {
      success: false,
      message: "Open WebUI 服务启动超时。",
      errorCode: "openwebui_start_timeout",
    };
  }

  async verifyHealth(): Promise<OperationResult> {
    const hermesHealthUrl = `${this.settings.hermesApiUrl.replace(/\/$/, "")}/health`;
    const hermesV1HealthUrl = `${this.settings.hermesApiUrl.replace(/\/$/, "")}/v1/health`;

    const hermesHealthOk = await isUrlReachable(hermesHealthUrl);
    const hermesV1HealthOk = await isUrlReachable(hermesV1HealthUrl);

    const modelController = new AbortController();
    const timer = setTimeout(() => modelController.abort(), 2500);

    let modelOk = false;
    try {
      const response = await fetch(`${this.settings.hermesApiUrl.replace(/\/$/, "")}/v1/models`, {
        signal: modelController.signal,
        headers: {
          Authorization: "Bearer hermes-local-key",
        },
      });
      modelOk = response.ok;
    } catch {
      modelOk = false;
    } finally {
      clearTimeout(timer);
    }

    const webuiOk = await isUrlReachable(this.settings.openWebuiUrl);

    if (hermesHealthOk && hermesV1HealthOk && modelOk && webuiOk) {
      return {
        success: true,
        message: "Hermes 和 Open WebUI 健康检查通过。",
      };
    }

    return {
      success: false,
      message: "健康检查未通过。",
      errorCode: "health_check_failed",
    };
  }

  async stop(): Promise<OperationResult> {
    const result = await this.compose.down();
    if (result.code !== 0) {
      return {
        success: false,
        message: `停止服务失败: ${result.stderr || result.stdout || "unknown error"}`,
        errorCode: "compose_down_failed",
      };
    }

    return {
      success: true,
      message: "服务已停止。",
    };
  }

  async restart(): Promise<OperationResult> {
    const result = await this.compose.restart();
    if (result.code !== 0) {
      return {
        success: false,
        message: `重启服务失败: ${result.stderr || result.stdout || "unknown error"}`,
        errorCode: "compose_restart_failed",
      };
    }

    return {
      success: true,
      message: "服务已重启。",
    };
  }
}
