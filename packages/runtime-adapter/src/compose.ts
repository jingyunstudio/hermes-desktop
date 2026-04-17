/**
 * @author Jingyun Studio
 * @copyright 2026 Jingyun Studio
 * @license MIT
 */

import path from "node:path";
import { runCommand, runCommandWithStream } from "./command";
import { log } from "./logger";
import { cleanDockerOutput } from "./docker-output";

export interface ComposeResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class DockerComposeManager {
  constructor(
    private readonly composeFilePath: string,
    private readonly projectName: string = "hermes-desktop"
  ) {}

  async up(services?: string[]): Promise<ComposeResult> {
    const args = ["compose", "-f", this.composeFilePath, "-p", this.projectName, "up", "-d"];
    if (services && services.length > 0) {
      args.push(...services);
    }

    // 使用实时流输出，显示容器启动日志
    return runCommandWithStream(
      "docker",
      args,
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      120000, // 2分钟超时
    );
  }

  async down(): Promise<ComposeResult> {
    // down 命令也需要显示日志
    return runCommandWithStream(
      "docker",
      ["compose", "-f", this.composeFilePath, "-p", this.projectName, "down"],
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      60000, // 1分钟超时
    );
  }

  async ps(): Promise<ComposeResult> {
    return runCommand("docker", ["compose", "-f", this.composeFilePath, "-p", this.projectName, "ps", "-a"]);
  }

  async logs(service?: string): Promise<ComposeResult> {
    const args = ["compose", "-f", this.composeFilePath, "-p", this.projectName, "logs"];
    if (service) {
      args.push(service);
    }
    return runCommand("docker", args);
  }

  async restart(services?: string[]): Promise<ComposeResult> {
    const args = ["compose", "-f", this.composeFilePath, "-p", this.projectName, "restart"];
    if (services && services.length > 0) {
      args.push(...services);
    }

    // restart 命令也需要显示日志
    return runCommandWithStream(
      "docker",
      args,
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      (data) => {
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      60000, // 1分钟超时
    );
  }

  async pull(services?: string[]): Promise<ComposeResult> {
    const args = ["compose", "-f", this.composeFilePath, "-p", this.projectName, "pull"];
    if (services && services.length > 0) {
      args.push(...services);
    }

    // 使用实时流输出，显示拉取进度
    // 注意：docker compose pull 不支持 --progress 参数
    return runCommandWithStream(
      "docker",
      args,
      (data) => {
        // stdout 输出
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      (data) => {
        // stderr 输出（docker compose pull 的进度在这里）
        const cleaned = cleanDockerOutput(data);
        const trimmed = cleaned.trim();
        if (trimmed) {
          log(trimmed);
        }
      },
      1800000, // 30分钟超时（compose pull 可能拉取多个镜像，适应极慢的网络环境）
    );
  }
}
