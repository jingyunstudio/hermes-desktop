import path from "node:path";
import { AppSettings, OperationResult } from "@hermes-desktop/shared-types";
import { DockerManager } from "./docker";
import { runCommand, sleep } from "./command";
import { isUrlReachable } from "./http";
import { log } from "./logger";
import { maskImageUrl } from "./image-mask";

const HERMES_CONTAINER_NAME = "hermes-runtime";
const HERMES_VOLUME = "hermes_runtime_data:/opt/data";
const HERMES_PORT_MAPPING = "8642:8642";

const HERMES_IMAGE_CANDIDATES = (() => {
  const candidates = [
    // DaoCloud 镜像加速（最高优先级，国内速度最快）
    "docker.m.daocloud.io/ghcr.io/nousresearch/hermes-agent:latest",
    "docker.m.daocloud.io/nousresearch/hermes-agent:latest",
    // 阿里云镜像加速（国内推荐）
    "registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest",
    // 腾讯云镜像加速（国内推荐）
    "ccr.ccs.tencentyun.com/nousresearch/hermes-agent:latest",
    // 南京大学镜像
    "docker.nju.edu.cn/nousresearch/hermes-agent:latest",
    "docker.nju.edu.cn/ghcr.io/nousresearch/hermes-agent:latest",
    // 上海交大镜像
    "docker.mirrors.sjtug.sjtu.edu.cn/nousresearch/hermes-agent:latest",
    // 中科大镜像
    "docker.mirrors.ustc.edu.cn/nousresearch/hermes-agent:latest",
    // 网易镜像
    "hub-mirror.c.163.com/nousresearch/hermes-agent:latest",
    // 百度云镜像
    "mirror.baidubce.com/nousresearch/hermes-agent:latest",
    // 华为云镜像
    "swr.cn-north-4.myhuaweicloud.com/nousresearch/hermes-agent:latest",
    // 官方源（国内可能无法访问，放在最后）
    "ghcr.io/nousresearch/hermes-agent:latest",
    "nousresearch/hermes-agent:latest",
  ];

  // 如果配置了自定义镜像，优先使用
  const customImage = process.env.HERMES_IMAGE;
  if (customImage) {
    candidates.unshift(customImage);
  }

  return candidates;
})();

const HERMES_OFFLINE_TAR_FILE_NAMES = [
  "hermes-agent-latest.tar",
  "hermes-agent-latest.tar.gz",
  "hermes-agent.tar",
  "hermes-agent.tar.gz",
];

const WSL_SYSTEM_DISTRO_PATTERN = /^(docker-desktop|docker-desktop-data)$/i;
const PREFERRED_WSL_DISTRO = "Ubuntu";

function getOfflineTarCandidates(fileNames: string[]): string[] {
  const resourceBases: string[] = [];
  const processWithResources = process as NodeJS.Process & { resourcesPath?: string };
  if (processWithResources.resourcesPath) {
    resourceBases.push(path.join(processWithResources.resourcesPath, "offline-images"));
  }

  resourceBases.push(path.join(process.cwd(), "resources", "offline-images"));

  const candidates = resourceBases.flatMap((baseDir) => fileNames.map((fileName) => path.join(baseDir, fileName)));
  return Array.from(new Set(candidates));
}

function parseWslDistros(raw: string): string[] {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickPreferredDistro(distros: string[]): string {
  const exact = distros.find((distro) => distro.toLowerCase() === PREFERRED_WSL_DISTRO.toLowerCase());
  if (exact) {
    return exact;
  }

  const ubuntuLike = distros.find((distro) => distro.toLowerCase().startsWith("ubuntu"));
  if (ubuntuLike) {
    return ubuntuLike;
  }

  return distros[0];
}

export class HermesRuntimeManager {
  constructor(
    private readonly docker: DockerManager,
    private readonly settings: AppSettings,
  ) {}

  private async detectSupportedWslDistro(): Promise<{ ok: true; distro: string } | { ok: false; message: string; errorCode: string }> {
    const versionCheck = await runCommand("wsl", ["--version"]);
    if (versionCheck.code !== 0) {
      const installWsl = await runCommand("wsl", ["--install", "--no-distribution"]);
      if (installWsl.code !== 0) {
        return {
          ok: false,
          message: `镜像拉取失败，且自动安装 WSL2 失败: ${installWsl.stderr || installWsl.stdout || "unknown error"}`,
          errorCode: "hermes_wsl_install_failed",
        };
      }
    }

    const distroList = await runCommand("wsl", ["-l", "-q"]);
    if (distroList.code !== 0) {
      return {
        ok: false,
        message: `镜像拉取失败，读取 WSL 发行版列表失败: ${distroList.stderr || distroList.stdout || "unknown error"}`,
        errorCode: "hermes_wsl_list_failed",
      };
    }

    const distros = parseWslDistros(distroList.stdout);
    let supportedDistros = distros.filter((name) => !WSL_SYSTEM_DISTRO_PATTERN.test(name));

    if (supportedDistros.length === 0) {
      const installDistro = await runCommand("wsl", ["--install", "-d", PREFERRED_WSL_DISTRO]);
      if (installDistro.code !== 0) {
        const detail = distros.length > 0 ? `当前仅检测到: ${distros.join(", ")}` : "当前未检测到任何发行版";
        return {
          ok: false,
          message: `镜像拉取失败，自动安装 ${PREFERRED_WSL_DISTRO} 失败（${detail}）: ${installDistro.stderr || installDistro.stdout || "unknown error"}`,
          errorCode: "hermes_wsl_distro_install_failed",
        };
      }

      const refreshedDistroList = await runCommand("wsl", ["-l", "-q"]);
      if (refreshedDistroList.code !== 0) {
        return {
          ok: false,
          message: `镜像拉取失败，${PREFERRED_WSL_DISTRO} 安装后读取发行版列表失败: ${refreshedDistroList.stderr || refreshedDistroList.stdout || "unknown error"}`,
          errorCode: "hermes_wsl_list_failed",
        };
      }

      supportedDistros = parseWslDistros(refreshedDistroList.stdout).filter((name) => !WSL_SYSTEM_DISTRO_PATTERN.test(name));
    }

    if (supportedDistros.length === 0) {
      return {
        ok: false,
        message: `镜像拉取失败，WSL2 环境初始化后仍未检测到可用 Linux 发行版（需要 ${PREFERRED_WSL_DISTRO}）。`,
        errorCode: "hermes_wsl_no_supported_distro",
      };
    }

    return {
      ok: true,
      distro: pickPreferredDistro(supportedDistros),
    };
  }

  private async tryOfficialQuickstartViaWsl(): Promise<OperationResult> {
    const detected = await this.detectSupportedWslDistro();
    if (!detected.ok) {
      return {
        success: false,
        message: detected.message,
        errorCode: detected.errorCode,
      };
    }

    const install = await runCommand("wsl", [
      "-d",
      detected.distro,
      "--",
      "sh",
      "-lc",
      "command -v bash >/dev/null 2>&1 || { echo 'bash not found'; exit 127; }; curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
    ]);

    if (install.code !== 0) {
      return {
        success: false,
        message: `官方 quickstart 安装失败（${detected.distro}）: ${install.stderr || install.stdout || "unknown error"}`,
        errorCode: "hermes_quickstart_failed",
      };
    }

    const startGateway = await runCommand("wsl", [
      "-d",
      detected.distro,
      "--",
      "sh",
      "-lc",
      "mkdir -p ~/.hermes/logs && nohup ~/.local/bin/hermes gateway run > ~/.hermes/logs/gateway.log 2>&1 &",
    ]);

    if (startGateway.code !== 0) {
      return {
        success: false,
        message: `官方 quickstart 已安装但启动 gateway 失败（${detected.distro}）: ${startGateway.stderr || startGateway.stdout || "unknown error"}`,
        errorCode: "hermes_quickstart_gateway_failed",
      };
    }

    return {
      success: true,
      message: `已通过官方 quickstart（WSL: ${detected.distro}）完成 Hermes 安装并启动 gateway。`,
    };
  }

  private async tryOfflineImageImport(): Promise<OperationResult> {
    const tarCandidates = getOfflineTarCandidates(HERMES_OFFLINE_TAR_FILE_NAMES);
    const loadResult = await this.docker.loadFromTarCandidates(HERMES_IMAGE_CANDIDATES, tarCandidates);

    if (!loadResult.success || !loadResult.image) {
      return {
        success: false,
        message: `离线镜像兜底失败: ${loadResult.message}`,
        errorCode: "hermes_offline_image_load_failed",
      };
    }

    const runResult = await this.docker.runDetached([
      "--name",
      HERMES_CONTAINER_NAME,
      "--restart",
      "unless-stopped",
      "-p",
      HERMES_PORT_MAPPING,
      "-v",
      HERMES_VOLUME,
      "-e",
      "API_SERVER_ENABLED=true",
      "-e",
      "API_SERVER_HOST=0.0.0.0",
      "-e",
      "API_SERVER_PORT=8642",
      "-e",
      "API_SERVER_KEY=hermes-local-key",
      loadResult.image,
      "gateway",
      "run",
    ]);

    if (runResult.code !== 0) {
      return {
        success: false,
        message: `离线镜像已导入但 Hermes 启动失败: ${runResult.stderr || runResult.stdout || "unknown error"}`,
        errorCode: "hermes_start_failed",
      };
    }

    return {
      success: true,
      message: `已通过离线镜像包完成 Hermes 安装并启动（${maskImageUrl(loadResult.image)}）。`,
    };
  }

  async ensureInstalledAndRunning(): Promise<OperationResult> {
    log("开始检查 Hermes 服务状态...");

    if (await isUrlReachable(this.settings.hermesApiUrl)) {
      log("Hermes 已在运行");
      return {
        success: true,
        message: "Hermes 已在运行。",
      };
    }

    log("Hermes 未运行，检查容器是否存在...");
    const exists = await this.docker.containerExists(HERMES_CONTAINER_NAME);

    if (!exists) {
      log("容器不存在，开始拉取镜像...");
      log(`尝试从 ${HERMES_IMAGE_CANDIDATES.length} 个镜像源拉取...`);

      const pullResult = await this.docker.pullWithRetryCandidates(HERMES_IMAGE_CANDIDATES, 2);
      if (!pullResult.success || !pullResult.image) {
        log("镜像拉取失败，尝试离线镜像导入...");
        const offlineFallback = await this.tryOfflineImageImport();
        if (offlineFallback.success) {
          return offlineFallback;
        }

        log("离线镜像导入失败，尝试 WSL quickstart...");
        const quickstartFallback = await this.tryOfficialQuickstartViaWsl();
        if (!quickstartFallback.success) {
          return {
            success: false,
            message: `Hermes 镜像拉取失败: ${pullResult.message}；离线镜像兜底失败: ${offlineFallback.message}；quickstart 兜底失败: ${quickstartFallback.message}`,
            errorCode: "hermes_image_pull_failed",
          };
        }

        return quickstartFallback;
      }

      log(`镜像拉取成功: ${maskImageUrl(pullResult.image)}，开始创建容器...`);
      const runResult = await this.docker.runDetached([
        "--name",
        HERMES_CONTAINER_NAME,
        "--restart",
        "unless-stopped",
        "-p",
        HERMES_PORT_MAPPING,
        "-v",
        HERMES_VOLUME,
        "-e",
        "API_SERVER_ENABLED=true",
        "-e",
        "API_SERVER_HOST=0.0.0.0",
        "-e",
        "API_SERVER_PORT=8642",
        "-e",
        "API_SERVER_KEY=hermes-local-key",
        pullResult.image,
        "gateway",
        "run",
      ]);

      if (runResult.code !== 0) {
        log(`容器启动失败: ${runResult.stderr || runResult.stdout}`);
        return {
          success: false,
          message: `Hermes 启动失败: ${runResult.stderr || runResult.stdout || "unknown error"}`,
          errorCode: "hermes_start_failed",
        };
      }
      log("容器创建成功，等待服务就绪...");
    } else {
      log("容器已存在，尝试启动...");
      const startResult = await this.docker.startContainer(HERMES_CONTAINER_NAME);
      if (startResult.code !== 0) {
        log(`容器启动失败: ${startResult.stderr || startResult.stdout}`);
        return {
          success: false,
          message: `Hermes 启动失败: ${startResult.stderr || startResult.stdout || "unknown error"}`,
          errorCode: "hermes_start_failed",
        };
      }
      log("容器启动成功");
    }

    log("等待服务健康检查（最多 60 秒）...");
    for (let i = 0; i < 40; i += 1) {
      const healthUrl = `${this.settings.hermesApiUrl.replace(/\/$/, "")}/health`;
      if (await isUrlReachable(healthUrl, { timeoutMs: 3000 })) {
        log(`服务就绪（第 ${i + 1} 次检查）`);
        return {
          success: true,
          message: "Hermes 启动成功。",
        };
      }

      log(`等待服务就绪... (${i + 1}/40)`);
      await sleep(1500);
    }

    log("服务启动超时");
    return {
      success: false,
      message: "Hermes 启动超时。",
      errorCode: "hermes_start_timeout",
    };
  }

  async verifyHealth(): Promise<OperationResult> {
    const healthOk = await isUrlReachable(`${this.settings.hermesApiUrl.replace(/\/$/, "")}/health`);
    const v1HealthOk = await isUrlReachable(`${this.settings.hermesApiUrl.replace(/\/$/, "")}/v1/health`);

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

    if (healthOk && v1HealthOk && modelOk) {
      return {
        success: true,
        message: "Hermes 健康检查通过。",
      };
    }

    return {
      success: false,
      message: "Hermes 健康检查未通过。",
      errorCode: "hermes_health_failed",
    };
  }
}
