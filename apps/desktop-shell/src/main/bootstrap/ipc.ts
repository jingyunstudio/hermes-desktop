import { ipcMain, shell } from "electron";
import { AppSettings, ModelConfig, TenantConfig } from "@hermes-desktop/shared-types";
import { DesktopBootstrapOrchestrator } from "./orchestrator";
import { DesktopDeviceBindingService } from "../binding/device-binding";
import { TenantConfigService } from "../services/tenant-config";
import { WindowsExecutorService } from "../services/windows-executor";
import { spawn } from "node:child_process";

export function registerBootstrapIpc(options: {
  settings: AppSettings;
  orchestrator: DesktopBootstrapOrchestrator;
  bindingService: DesktopDeviceBindingService;
  tenantConfigService: TenantConfigService;
}) {
  const { settings, orchestrator, bindingService, tenantConfigService } = options;
  const windowsExecutor = new WindowsExecutorService();

  ipcMain.handle("settings:get", async () => settings);

  ipcMain.handle("bootstrap:getState", async () => orchestrator.current());

  ipcMain.handle("bootstrap:start", async () => orchestrator.start());

  ipcMain.handle("bootstrap:retry", async () => orchestrator.retry());

  ipcMain.handle("bootstrap:repair", async () => orchestrator.repair());

  ipcMain.handle("bootstrap:openWebui", async () => {
    const ready = await orchestrator.ensureReadyForOpenWebui();
    if (!ready.success) {
      return ready;
    }

    await shell.openExternal(settings.openWebuiUrl);

    return {
      success: true,
      message: "Open WebUI 已打开。",
    };
  });

  ipcMain.handle("binding:getState", async () => bindingService.getState());

  ipcMain.handle("binding:activate", async (_event, pairCode: string) => bindingService.activateWithPairCode(pairCode));

  ipcMain.handle("binding:openUserApp", async () => {
    const url = settings.jingyunUserAppHermesUrl || "http://localhost:3000/hermes";
    await shell.openExternal(url);
    return {
      success: true,
      message: "已打开 User-App 绑定页面。",
    };
  });

  ipcMain.handle("health:ping", async () => ({
    desktop: "ok",
    timestamp: Date.now(),
  }));

  ipcMain.handle("model:saveConfig", async (_event, config: ModelConfig) => {
    try {
      const yamlContent = `model:
  provider: ${config.provider}
  base_url: ${config.baseUrl}
  default: ${config.defaultModel}
  api_key: ${config.apiKey}
`;

      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("docker", [
          "exec",
          "-i",
          "hermes-desktop-runtime",
          "sh",
          "-c",
          "cat > /opt/data/config.yaml"
        ], {
          windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
          stdout += String(chunk);
        });

        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });

        child.on("error", (error) => {
          resolve({ code: -1, stdout, stderr: error.message });
        });

        child.on("close", (code) => {
          resolve({ code: code || 0, stdout, stderr });
        });

        // 写入 YAML 内容到 stdin
        child.stdin.write(yamlContent);
        child.stdin.end();
      });

      if (result.code !== 0) {
        return {
          success: false,
          message: `保存配置失败: ${result.stderr || result.stdout}`,
          errorCode: "docker_exec_failed",
        };
      }

      return {
        success: true,
        message: "模型配置已保存",
      };
    } catch (error) {
      return {
        success: false,
        message: `保存配置失败: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "save_config_error",
      };
    }
  });

  // 租户配置相关
  ipcMain.handle("tenant:isConfigured", async () => tenantConfigService.isConfigured());

  ipcMain.handle("tenant:getConfig", async () => tenantConfigService.loadConfig());

  ipcMain.handle("tenant:saveConfig", async (_event, config: TenantConfig) => {
    try {
      tenantConfigService.saveConfig(config);
      return {
        success: true,
        message: "租户配置已保存",
      };
    } catch (error) {
      return {
        success: false,
        message: `保存配置失败: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "save_tenant_config_error",
      };
    }
  });

  ipcMain.handle("tenant:configureFromPairCode", async (_event, pairCode: string, workspaceDir?: string) => {
    try {
      // 先激活设备码
      const bindingState = await bindingService.activateWithPairCode(pairCode);
      
      if (bindingState.status !== "bound") {
        return {
          success: false,
          message: bindingState.message || "设备码激活失败",
          errorCode: "pair_code_activation_failed",
        };
      }

      // 从绑定信息中提取租户配置
      const tenantConfig = tenantConfigService.extractFromBinding({
        tenantId: bindingState.tenantId,
        tenantSlug: bindingState.tenantId, // 使用 tenantId 作为 slug
        tenantDomain: settings.jingyunBaseUrl, // 使用当前配置的基础 URL
        workspaceDir, // 传递工作目录
      });

      // 保存租户配置
      tenantConfigService.saveConfig(tenantConfig);

      return {
        success: true,
        message: "租户配置已完成",
        data: tenantConfig,
      };
    } catch (error) {
      return {
        success: false,
        message: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "configure_from_pair_code_error",
      };
    }
  });

  // Windows 执行器 IPC 处理
  ipcMain.handle("windows:executeCommand", async (_event, command: string, cwd?: string) => {
    return windowsExecutor.executeCommand(command, cwd);
  });

  ipcMain.handle("windows:executePowerShell", async (_event, script: string, cwd?: string) => {
    return windowsExecutor.executePowerShell(script, cwd);
  });

  ipcMain.handle("windows:openFile", async (_event, filePath: string) => {
    return windowsExecutor.openFile(filePath);
  });

  ipcMain.handle("windows:readFile", async (_event, filePath: string) => {
    return windowsExecutor.readFile(filePath);
  });

  ipcMain.handle("windows:writeFile", async (_event, filePath: string, content: string) => {
    return windowsExecutor.writeFile(filePath, content);
  });

  ipcMain.handle("windows:listDirectory", async (_event, dirPath: string) => {
    return windowsExecutor.listDirectory(dirPath);
  });
}
