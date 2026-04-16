import path from "node:path";
import { AppSettings, OperationResult } from "@hermes-desktop/shared-types";
import { DockerManager } from "./docker";
import { isUrlReachable } from "./http";
import { sleep } from "./command";
import { maskImageUrl } from "./image-mask";

const OPEN_WEBUI_CONTAINER_NAME = "hermes-open-webui";
const OPEN_WEBUI_VOLUME = "hermes_open_webui_data:/app/backend/data";
const OPEN_WEBUI_PORT_MAPPING = "3004:8080";

const OPEN_WEBUI_IMAGE_CANDIDATES = (() => {
  const candidates = [
    // DaoCloud 镜像加速（最高优先级，国内速度最快）
    "docker.m.daocloud.io/ghcr.io/open-webui/open-webui:main",
    "docker.m.daocloud.io/openwebui/open-webui:main",
    // 阿里云镜像加速（国内推荐）
    "registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main",
    // 腾讯云镜像加速（国内推荐）
    "ccr.ccs.tencentyun.com/open-webui/open-webui:main",
    // 南京大学镜像
    "docker.nju.edu.cn/open-webui/open-webui:main",
    "docker.nju.edu.cn/ghcr.io/open-webui/open-webui:main",
    // 上海交大镜像
    "docker.mirrors.sjtug.sjtu.edu.cn/open-webui/open-webui:main",
    // 中科大镜像
    "docker.mirrors.ustc.edu.cn/open-webui/open-webui:main",
    // 网易镜像
    "hub-mirror.c.163.com/open-webui/open-webui:main",
    // 百度云镜像
    "mirror.baidubce.com/open-webui/open-webui:main",
    // 华为云镜像
    "swr.cn-north-4.myhuaweicloud.com/open-webui/open-webui:main",
    // 官方源（国内可能无法访问，放在最后）
    "ghcr.io/open-webui/open-webui:main",
    "openwebui/open-webui:main",
  ];

  // 如果配置了自定义镜像，优先使用
  const customImage = process.env.OPENWEBUI_IMAGE;
  if (customImage) {
    candidates.unshift(customImage);
  }

  return candidates;
})();

const OPEN_WEBUI_OFFLINE_TAR_FILE_NAMES = [
  "open-webui-main.tar",
  "open-webui-main.tar.gz",
  "open-webui.tar",
  "open-webui.tar.gz",
];

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

export class OpenWebuiManager {
  constructor(
    private readonly docker: DockerManager,
    private readonly settings: AppSettings,
  ) {}

  private async tryOfflineImageImport(): Promise<OperationResult> {
    const tarCandidates = getOfflineTarCandidates(OPEN_WEBUI_OFFLINE_TAR_FILE_NAMES);
    const loadResult = await this.docker.loadFromTarCandidates(OPEN_WEBUI_IMAGE_CANDIDATES, tarCandidates);

    if (!loadResult.success || !loadResult.image) {
      return {
        success: false,
        message: `离线镜像兜底失败: ${loadResult.message}`,
        errorCode: "openwebui_offline_image_load_failed",
      };
    }

    const runResult = await this.docker.runDetached([
      "--name",
      OPEN_WEBUI_CONTAINER_NAME,
      "-p",
      OPEN_WEBUI_PORT_MAPPING,
      "-v",
      OPEN_WEBUI_VOLUME,
      "--restart",
      "unless-stopped",
      "-e",
      "OPENAI_API_BASE_URL=http://host.docker.internal:8642/v1",
      "-e",
      "OPENAI_API_KEY=hermes-local-key",
      "--add-host",
      "host.docker.internal:host-gateway",
      loadResult.image,
    ]);

    if (runResult.code !== 0) {
      return {
        success: false,
        message: `离线镜像已导入但 Open WebUI 启动失败: ${runResult.stderr || runResult.stdout || "unknown error"}`,
        errorCode: "openwebui_start_failed",
      };
    }

    return {
      success: true,
      message: `已通过离线镜像包完成 Open WebUI 安装并启动（${maskImageUrl(loadResult.image)}）。`,
    };
  }

  async ensureInstalledAndRunning(): Promise<OperationResult> {
    if (await isUrlReachable(this.settings.openWebuiUrl)) {
      return {
        success: true,
        message: "Open WebUI 已在运行。",
      };
    }

    const exists = await this.docker.containerExists(OPEN_WEBUI_CONTAINER_NAME);

    if (!exists) {
      const pullResult = await this.docker.pullWithRetryCandidates(OPEN_WEBUI_IMAGE_CANDIDATES, 2);
      if (!pullResult.success || !pullResult.image) {
        const offlineFallback = await this.tryOfflineImageImport();
        if (!offlineFallback.success) {
          return {
            success: false,
            message: `Open WebUI 镜像拉取失败: ${pullResult.message}；离线镜像兜底失败: ${offlineFallback.message}`,
            errorCode: "openwebui_image_pull_failed",
          };
        }

        return offlineFallback;
      }

      const runResult = await this.docker.runDetached([
        "--name",
        OPEN_WEBUI_CONTAINER_NAME,
        "-p",
        OPEN_WEBUI_PORT_MAPPING,
        "-v",
        OPEN_WEBUI_VOLUME,
        "--restart",
        "unless-stopped",
        "-e",
        "OPENAI_API_BASE_URL=http://host.docker.internal:8642/v1",
        "-e",
        "OPENAI_API_KEY=hermes-local-key",
        "--add-host",
        "host.docker.internal:host-gateway",
        pullResult.image,
      ]);

      if (runResult.code !== 0) {
        return {
          success: false,
          message: `Open WebUI 启动失败: ${runResult.stderr || runResult.stdout || "unknown error"}`,
          errorCode: "openwebui_start_failed",
        };
      }
    } else {
      const startResult = await this.docker.startContainer(OPEN_WEBUI_CONTAINER_NAME);
      if (startResult.code !== 0) {
        return {
          success: false,
          message: `Open WebUI 启动失败: ${startResult.stderr || startResult.stdout || "unknown error"}`,
          errorCode: "openwebui_start_failed",
        };
      }
    }

    for (let i = 0; i < 20; i += 1) {
      if (await isUrlReachable(this.settings.openWebuiUrl)) {
        return {
          success: true,
          message: "Open WebUI 启动成功。",
        };
      }

      await sleep(1500);
    }

    return {
      success: false,
      message: "Open WebUI 启动超时。",
      errorCode: "openwebui_start_timeout",
    };
  }

  async verifyHealth(): Promise<OperationResult> {
    const ok = await isUrlReachable(this.settings.openWebuiUrl);

    if (ok) {
      return {
        success: true,
        message: "Open WebUI 健康检查通过。",
      };
    }

    return {
      success: false,
      message: "Open WebUI 健康检查未通过。",
      errorCode: "openwebui_health_failed",
    };
  }
}
