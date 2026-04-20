import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { TenantConfig } from "@hermes-desktop/shared-types";

export class TenantConfigService {
  private configPath: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.configPath = path.join(userDataPath, "tenant-config.json");
  }

  /**
   * 检查是否已配置租户信息
   */
  isConfigured(): boolean {
    try {
      if (!fs.existsSync(this.configPath)) {
        return false;
      }
      const config = this.loadConfig();
      return config.configured === true && !!config.baseUrl;
    } catch (error) {
      console.error("[TenantConfig] Failed to check configuration:", error);
      return false;
    }
  }

  /**
   * 加载租户配置
   */
  loadConfig(): TenantConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, "utf-8");
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("[TenantConfig] Failed to load configuration:", error);
    }

    // 返回默认配置
    return {
      baseUrl: process.env.JINGYUN_BASE_URL || "http://localhost:8889",
      userAppUrl: process.env.JINGYUN_USER_APP_HERMES_URL || "http://localhost:3003/hermes",
      tenantSlug: process.env.JINGYUN_TENANT_SLUG || "",
      configured: false,
    };
  }

  /**
   * 保存租户配置
   */
  saveConfig(config: TenantConfig): void {
    try {
      const configToSave = {
        ...config,
        configured: true,
      };
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), "utf-8");
      console.log("[TenantConfig] Configuration saved successfully");

      // 同时更新环境变量
      process.env.JINGYUN_BASE_URL = config.baseUrl;
      process.env.JINGYUN_USER_APP_HERMES_URL = config.userAppUrl;
      process.env.JINGYUN_TENANT_SLUG = config.tenantSlug;
    } catch (error) {
      console.error("[TenantConfig] Failed to save configuration:", error);
      throw error;
    }
  }

  /**
   * 从设备绑定信息中提取租户配置
   */
  extractFromBinding(bindingData: {
    tenantId?: string;
    tenantSlug?: string;
    tenantDomain?: string;
    workspaceDir?: string;
  }): TenantConfig {
    const baseUrl = bindingData.tenantDomain || process.env.JINGYUN_BASE_URL || "http://localhost:8889";
    
    return {
      baseUrl,
      userAppUrl: `${baseUrl}/hermes`,
      tenantSlug: bindingData.tenantSlug || "",
      workspaceDir: bindingData.workspaceDir, // 保存工作目录
      configured: true,
    };
  }
}
