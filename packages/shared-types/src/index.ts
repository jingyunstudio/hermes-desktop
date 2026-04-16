export type HermesDeployStatus = "deploying" | "health_check" | "register" | "ready" | "failed";

export interface InstanceSummary {
  instanceId: string;
  status: "online" | "offline" | "disabled";
  deployStatus?: HermesDeployStatus;
}

export type BootstrapStage =
  | "precheck"
  | "install_prerequisites"
  | "install_hermes"
  | "verify_health";

export type BootstrapStepStatus = "pending" | "running" | "success" | "failed";

export type BootstrapPhase = "idle" | "running" | "ready" | "failed";

export interface BootstrapStepState {
  stage: BootstrapStage;
  status: BootstrapStepStatus;
  message: string;
  updatedAt: number;
  errorCode?: string;
  canRetry: boolean;
}

export interface BootstrapState {
  phase: BootstrapPhase;
  currentStage: BootstrapStage | null;
  steps: Record<BootstrapStage, BootstrapStepState>;
  updatedAt: number;
  logs: string[]; // 全局日志数组，简单直接
}

export interface OperationResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface AppSettings {
  jingyunBaseUrl: string;
  openWebuiUrl: string;
  hermesApiUrl: string;
  autoLaunch: boolean;
}
