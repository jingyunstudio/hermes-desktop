import { contextBridge, ipcRenderer } from "electron";
import { AppSettings, BootstrapState, OperationResult } from "@hermes-desktop/shared-types";

const desktopApi = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  getBootstrapState: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:getState"),
  startBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:start"),
  retryBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:retry"),
  repairBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:repair"),
  openWebui: (): Promise<OperationResult> => ipcRenderer.invoke("bootstrap:openWebui"),
  onBootstrapStateChanged: (listener: (state: BootstrapState) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: BootstrapState) => listener(state);
    ipcRenderer.on("bootstrap:stateChanged", wrapped);
    return () => {
      ipcRenderer.removeListener("bootstrap:stateChanged", wrapped);
    };
  },
  ping: (): Promise<{ desktop: string; timestamp: number }> => ipcRenderer.invoke("health:ping"),
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);

declare global {
  interface Window {
    desktopApi: typeof desktopApi;
  }
}
