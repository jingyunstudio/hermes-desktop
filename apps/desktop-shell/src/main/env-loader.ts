import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { decrypt } from "./env-crypto";

/**
 * 加载 .env.local 配置文件
 * 优先级：
 * 1. 应用安装目录的 .env.local.encrypted（加密版本）
 * 2. 应用安装目录的 .env.local（明文版本，开发用）
 * 3. 用户数据目录的 .env.local
 */
export function loadEnvConfig(): void {
  const envFiles = [
    // 应用安装目录 - 加密版本（生产环境）
    { path: path.join(process.resourcesPath, ".env.local.encrypted"), encrypted: true },
    // 应用安装目录 - 明文版本（开发环境）
    { path: path.join(process.resourcesPath, ".env.local"), encrypted: false },
    // 用户数据目录
    { path: path.join(app.getPath("userData"), ".env.local"), encrypted: false },
    // 开发环境：项目根目录
    { path: path.join(__dirname, "../../../../.env.local"), encrypted: false },
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile.path)) {
      console.log(`[ENV] Loading config from: ${envFile.path}`);
      const content = fs.readFileSync(envFile.path, "utf-8");

      if (envFile.encrypted) {
        try {
          const decrypted = decrypt(content);
          parseEnvFile(decrypted);
          console.log("[ENV] Successfully loaded encrypted config");
        } catch (error) {
          console.error("[ENV] Failed to decrypt config:", error);
          continue;
        }
      } else {
        parseEnvFile(content);
      }
      return;
    }
  }

  console.log("[ENV] No .env.local file found, using defaults");
}

function parseEnvFile(content: string): void {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // 解析 KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      // 只在环境变量不存在时设置
      if (!process.env[key]) {
        process.env[key] = value;
        console.log(`[ENV] Set ${key}=${value}`);
      }
    }
  }
}
