/**
 * @author Jingyun Studio
 * @copyright 2026 Jingyun Studio
 * @license MIT
 */

import path from "node:path";
import { AppSettings, OperationResult } from "@hermes-desktop/shared-types";
import { DockerManager } from "./docker";
import { HermesComposeManager } from "./hermes-compose";
import { isUrlReachable } from "./http";
import { setLogCallback, LogCallback } from "./logger";

export interface RuntimeStatus {
  installed: boolean;
  running: boolean;
  version?: string;
}

export type { ProgressCallback, DockerInstallResult } from "./docker-installer";
export type { LogCallback } from "./logger";
export { maskImageUrl } from "./image-mask";
export { setCurrentStage, setLogCallback } from "./logger";

function getComposeFilePath(): string {
  const processWithResources = process as NodeJS.Process & { resourcesPath?: string };
  if (processWithResources.resourcesPath) {
    return path.join(processWithResources.resourcesPath, "compose", "docker-compose.yml");
  }
  return path.join(process.cwd(), "resources", "compose", "docker-compose.yml");
}

export class HermesRuntimeAdapter {
  private readonly docker: DockerManager;
  private readonly compose: HermesComposeManager;

  constructor(private readonly settings: AppSettings, logCallback?: LogCallback) {
    this.docker = new DockerManager();
    const composeFilePath = getComposeFilePath();
    this.compose = new HermesComposeManager(this.docker, settings, composeFilePath);

    if (logCallback) {
      setLogCallback(logCallback);
    }
  }

  async status(): Promise<RuntimeStatus> {
    const hermesRunning = await isUrlReachable(this.settings.hermesApiUrl);

    return {
      installed: await this.docker.isInstalled(),
      running: hermesRunning,
      version: "docker",
    };
  }

  async precheck(): Promise<OperationResult> {
    if (process.platform !== "win32") {
      return {
        success: false,
        message: "当前仅支持 Windows 一键部署。",
        errorCode: "platform_not_supported",
      };
    }

    return {
      success: true,
      message: "环境检测通过。",
    };
  }

  async installPrerequisites(): Promise<OperationResult> {
    return this.docker.ensureReady();
  }

  async installHermes(): Promise<OperationResult> {
    return this.compose.ensureInstalledAndRunning();
  }

  async verifyHealth(): Promise<OperationResult> {
    return this.compose.verifyHealth();
  }

  async stop(): Promise<OperationResult> {
    return this.compose.stop();
  }

  async restart(): Promise<OperationResult> {
    return this.compose.restart();
  }
}
