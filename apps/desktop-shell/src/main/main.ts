import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { AppSettings, BootstrapState } from "@hermes-desktop/shared-types";
import { DesktopBootstrapOrchestrator } from "./bootstrap/orchestrator";
import { BootstrapStateStore } from "./bootstrap/store";
import { registerBootstrapIpc } from "./bootstrap/ipc";
import { loadEnvConfig } from "./env-loader";

// 在应用启动时加载环境配置
loadEnvConfig();

const APP_SETTINGS: AppSettings = {
  jingyunBaseUrl: "http://localhost:8888",
  openWebuiUrl: "http://127.0.0.1:3004",
  hermesApiUrl: "http://127.0.0.1:8642",
  autoLaunch: false,
};

let mainWindow: BrowserWindow | null = null;
let bootstrapOrchestrator: DesktopBootstrapOrchestrator | null = null;

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

  bootstrapOrchestrator = new DesktopBootstrapOrchestrator(APP_SETTINGS, stateStore, emitBootstrapState);

  registerBootstrapIpc({
    settings: APP_SETTINGS,
    orchestrator: bootstrapOrchestrator,
  });

  createMainWindow();

  void bootstrapOrchestrator.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
