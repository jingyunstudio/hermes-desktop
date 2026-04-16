import { ipcMain, shell } from "electron";
import { AppSettings } from "@hermes-desktop/shared-types";
import { DesktopBootstrapOrchestrator } from "./orchestrator";

export function registerBootstrapIpc(options: {
  settings: AppSettings;
  orchestrator: DesktopBootstrapOrchestrator;
}) {
  const { settings, orchestrator } = options;

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

  ipcMain.handle("health:ping", async () => ({
    desktop: "ok",
    timestamp: Date.now(),
  }));
}
