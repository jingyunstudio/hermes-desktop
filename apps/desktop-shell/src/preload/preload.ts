import { contextBridge, ipcRenderer } from "electron";
import { AppSettings, BootstrapState, DeviceBindingState, OperationResult, ModelConfig, TenantConfig } from "@hermes-desktop/shared-types";

const desktopApi = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  getBootstrapState: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:getState"),
  startBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:start"),
  retryBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:retry"),
  repairBootstrap: (): Promise<BootstrapState> => ipcRenderer.invoke("bootstrap:repair"),
  openWebui: (): Promise<OperationResult> => ipcRenderer.invoke("bootstrap:openWebui"),
  getBindingState: (): Promise<DeviceBindingState> => ipcRenderer.invoke("binding:getState"),
  activateByPairCode: (pairCode: string): Promise<DeviceBindingState> => ipcRenderer.invoke("binding:activate", pairCode),
  openBindingPage: (): Promise<OperationResult> => ipcRenderer.invoke("binding:openUserApp"),
  saveModelConfig: (config: ModelConfig): Promise<OperationResult> => ipcRenderer.invoke("model:saveConfig", config),
  isTenantConfigured: (): Promise<boolean> => ipcRenderer.invoke("tenant:isConfigured"),
  getTenantConfig: (): Promise<TenantConfig> => ipcRenderer.invoke("tenant:getConfig"),
  saveTenantConfig: (config: TenantConfig): Promise<OperationResult> => ipcRenderer.invoke("tenant:saveConfig", config),
  configureFromPairCode: (pairCode: string, workspaceDir?: string): Promise<OperationResult & { data?: TenantConfig }> => ipcRenderer.invoke("tenant:configureFromPairCode", pairCode, workspaceDir),
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
