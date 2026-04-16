import {
  BootstrapPhase,
  BootstrapStage,
  BootstrapState,
  BootstrapStepState,
  BootstrapStepStatus,
  OperationResult,
} from "@hermes-desktop/shared-types";

export const BOOTSTRAP_STAGES: BootstrapStage[] = [
  "precheck",
  "install_prerequisites",
  "install_hermes",
  "verify_health",
];

function defaultMessage(stage: BootstrapStage): string {
  switch (stage) {
    case "precheck":
      return "等待环境检测";
    case "install_prerequisites":
      return "等待安装必备环境";
    case "install_hermes":
      return "等待安装 Hermes 和 Open WebUI";
    case "verify_health":
      return "等待健康检查";
    default:
      return "等待执行";
  }
}

function createStep(stage: BootstrapStage): BootstrapStepState {
  return {
    stage,
    status: "pending",
    message: defaultMessage(stage),
    updatedAt: Date.now(),
    canRetry: false,
  };
}

export function createInitialBootstrapState(): BootstrapState {
  return {
    phase: "idle",
    currentStage: null,
    steps: {
      precheck: createStep("precheck"),
      install_prerequisites: createStep("install_prerequisites"),
      install_hermes: createStep("install_hermes"),
      verify_health: createStep("verify_health"),
    },
    updatedAt: Date.now(),
    logs: [], // 全局日志数组
  };
}

function withStepStatus(
  state: BootstrapState,
  stage: BootstrapStage,
  status: BootstrapStepStatus,
  message: string,
  canRetry: boolean,
  errorCode?: string,
): BootstrapState {
  return {
    ...state,
    steps: {
      ...state.steps,
      [stage]: {
        ...state.steps[stage],
        status,
        message,
        canRetry,
        errorCode,
        updatedAt: Date.now(),
      },
    },
    updatedAt: Date.now(),
  };
}

export function addStageLog(state: BootstrapState, stage: BootstrapStage, log: string): BootstrapState {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${log}`;

  return {
    ...state,
    logs: [...state.logs, logLine],
    updatedAt: Date.now(),
  };
}

export function markStageRunning(state: BootstrapState, stage: BootstrapStage, message: string): BootstrapState {
  return {
    ...withStepStatus(state, stage, "running", message, false),
    phase: "running",
    currentStage: stage,
    updatedAt: Date.now(),
  };
}

export function markStageSuccess(state: BootstrapState, stage: BootstrapStage, message: string): BootstrapState {
  const withSuccess = withStepStatus(state, stage, "success", message, false);
  return {
    ...withSuccess,
    currentStage: null,
    updatedAt: Date.now(),
  };
}

export function markStageFailed(state: BootstrapState, stage: BootstrapStage, result: OperationResult): BootstrapState {
  return {
    ...withStepStatus(state, stage, "failed", result.message, true, result.errorCode),
    phase: "failed",
    currentStage: stage,
    updatedAt: Date.now(),
  };
}

export function markBootstrapReady(state: BootstrapState): BootstrapState {
  return {
    ...state,
    phase: "ready",
    currentStage: null,
    updatedAt: Date.now(),
  };
}

export function resetStateForRepair(): BootstrapState {
  return createInitialBootstrapState();
}
