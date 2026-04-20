import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { AppSettings, BootstrapState } from "@hermes-desktop/shared-types";
import { DesktopBootstrapOrchestrator } from "./bootstrap/orchestrator";
import { BootstrapStateStore } from "./bootstrap/store";
import { registerBootstrapIpc } from "./bootstrap/ipc";
import { loadEnvConfig } from "./env-loader";
import { DesktopDeviceBindingService } from "./binding/device-binding";
import { TenantConfigService } from "./services/tenant-config";
import { WindowsApiServer } from "./services/windows-api-server";

// 在应用启动时加载环境配置
loadEnvConfig();

const APP_SETTINGS: AppSettings = {
  jingyunBaseUrl: process.env.JINGYUN_BASE_URL || "http://localhost:8888",
  jingyunUserAppHermesUrl: process.env.JINGYUN_USER_APP_HERMES_URL || "http://localhost:3000/hermes",
  jingyunTenantSlug: process.env.JINGYUN_TENANT_SLUG || undefined,
  openWebuiUrl: "http://127.0.0.1:3004",
  hermesApiUrl: "http://127.0.0.1:8642",
  autoLaunch: false,
};

let mainWindow: BrowserWindow | null = null;
let bootstrapOrchestrator: DesktopBootstrapOrchestrator | null = null;
let deviceBindingService: DesktopDeviceBindingService | null = null;
let windowsApiServer: WindowsApiServer | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 窗口最大化
  mainWindow.maximize();

  // 隐藏菜单栏
  Menu.setApplicationMenu(null);

  const rendererUrl = process.env.DESKTOP_RENDERER_URL;
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function emitBootstrapState(state: BootstrapState) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("bootstrap:stateChanged", state);
}

app.whenReady().then(() => {
  const stateStore = new BootstrapStateStore();
  const tenantConfigService = new TenantConfigService();

  // 加载租户配置（如果已配置）
  const tenantConfig = tenantConfigService.loadConfig();
  if (tenantConfig.configured) {
    // 使用已保存的租户配置更新 APP_SETTINGS
    APP_SETTINGS.jingyunBaseUrl = tenantConfig.baseUrl;
    APP_SETTINGS.jingyunUserAppHermesUrl = tenantConfig.userAppUrl;
    APP_SETTINGS.jingyunTenantSlug = tenantConfig.tenantSlug;
    
    // 设置工作目录环境变量（供 Docker Compose 使用）
    if (tenantConfig.workspaceDir) {
      process.env.HERMES_WORKSPACE = tenantConfig.workspaceDir;
      console.log(`[Main] Set HERMES_WORKSPACE=${tenantConfig.workspaceDir}`);
    }
  }

  bootstrapOrchestrator = new DesktopBootstrapOrchestrator(APP_SETTINGS, stateStore, emitBootstrapState);
  deviceBindingService = new DesktopDeviceBindingService(APP_SETTINGS);

  registerBootstrapIpc({
    settings: APP_SETTINGS,
    orchestrator: bootstrapOrchestrator,
    bindingService: deviceBindingService,
    tenantConfigService,
  });

  createMainWindow();

  // 启动 Windows API 服务器
  windowsApiServer = new WindowsApiServer(8643);
  windowsApiServer.start().catch((error) => {
    console.error("[Main] Failed to start Windows API server:", error);
  });

  void bootstrapOrchestrator.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  deviceBindingService?.dispose();
  windowsApiServer?.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  deviceBindingService?.dispose();
  windowsApiServer?.stop();
});
