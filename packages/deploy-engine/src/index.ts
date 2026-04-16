import {
  BootstrapStage,
  BootstrapState,
  OperationResult,
} from "@hermes-desktop/shared-types";
import {
  BOOTSTRAP_STAGES,
  createInitialBootstrapState,
  markBootstrapReady,
  markStageFailed,
  markStageRunning,
  markStageSuccess,
  resetStateForRepair,
  addStageLog,
} from "./state-machine";

export interface BootstrapOperations {
  precheck(): Promise<OperationResult>;
  installPrerequisites(): Promise<OperationResult>;
  installHermes(): Promise<OperationResult>;
  verifyHealth(): Promise<OperationResult>;
}

export type BootstrapStateListener = (state: BootstrapState) => void;

const stageToOperation: Record<BootstrapStage, keyof BootstrapOperations> = {
  precheck: "precheck",
  install_prerequisites: "installPrerequisites",
  install_hermes: "installHermes",
  verify_health: "verifyHealth",
};

export class DeployOrchestrator {
  private state: BootstrapState;

  constructor(
    private readonly operations: BootstrapOperations,
    private readonly onStateChange?: BootstrapStateListener,
    initialState?: BootstrapState,
  ) {
    this.state = initialState ?? createInitialBootstrapState();
  }

  current(): BootstrapState {
    return this.state;
  }

  setState(state: BootstrapState): BootstrapState {
    this.state = state;
    this.emit();
    return this.state;
  }

  async start(): Promise<BootstrapState> {
    if (this.state.phase === "running") {
      return this.state;
    }

    if (this.state.phase === "ready") {
      return this.state;
    }

    for (const stage of BOOTSTRAP_STAGES) {
      const existing = this.state.steps[stage];
      if (existing.status === "success") {
        continue;
      }

      this.state = markStageRunning(this.state, stage, `执行 ${stage}`);
      this.emit();

      const operationName = stageToOperation[stage];
      const result = await this.operations[operationName]();
      if (!result.success) {
        this.state = markStageFailed(this.state, stage, result);
        this.emit();
        return this.state;
      }

      this.state = markStageSuccess(this.state, stage, result.message);
      this.emit();
    }

    this.state = markBootstrapReady(this.state);
    this.emit();
    return this.state;
  }

  async retryCurrent(): Promise<BootstrapState> {
    if (this.state.phase !== "failed" || !this.state.currentStage) {
      return this.state;
    }

    const failedStage = this.state.currentStage;
    this.state = markStageRunning(this.state, failedStage, `重试 ${failedStage}`);
    this.emit();

    const operationName = stageToOperation[failedStage];
    const result = await this.operations[operationName]();
    if (!result.success) {
      this.state = markStageFailed(this.state, failedStage, result);
      this.emit();
      return this.state;
    }

    this.state = markStageSuccess(this.state, failedStage, result.message);
    this.emit();

    return this.start();
  }

  async repair(): Promise<BootstrapState> {
    this.state = resetStateForRepair();
    this.emit();
    return this.start();
  }

  private emit() {
    this.onStateChange?.(this.state);
  }
}

export {
  BOOTSTRAP_STAGES,
  createInitialBootstrapState,
  markBootstrapReady,
  markStageFailed,
  markStageRunning,
  markStageSuccess,
  resetStateForRepair,
  addStageLog,
};
