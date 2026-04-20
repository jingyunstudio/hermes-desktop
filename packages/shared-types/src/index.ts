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

export type DeviceBindingStatus = "idle" | "pending" | "bound" | "expired" | "error";

export interface DeviceBindingState {
  status: DeviceBindingStatus;
  pairCode?: string;
  expiresAt?: number;
  pollIntervalSec?: number;
  instanceId?: string;
  tenantId?: string;
  userId?: string;
  message?: string;
  updatedAt: number;
}

export interface AppSettings {
  jingyunBaseUrl: string;
  jingyunUserAppHermesUrl?: string;
  jingyunTenantSlug?: string;
  openWebuiUrl: string;
  hermesApiUrl: string;
  autoLaunch: boolean;
}

export interface ModelConfig {
  provider: string;
  baseUrl: string;
  defaultModel: string;
  apiKey: string;
}

export interface TenantConfig {
  baseUrl: string;
  userAppUrl: string;
  tenantSlug: string;
  workspaceDir?: string; // Hermes 工作目录
  configured: boolean;
}
