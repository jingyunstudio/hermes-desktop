import { AppSettings, BootstrapState, OperationResult } from "@hermes-desktop/shared-types";
import { BootstrapOperations, DeployOrchestrator, addStageLog } from "@hermes-desktop/deploy-engine";
import { HermesRuntimeAdapter, setCurrentStage } from "@hermes-desktop/runtime-adapter";
import { BootstrapStateStore } from "./store";

export class DesktopBootstrapOrchestrator {
  private readonly runtimeAdapter: HermesRuntimeAdapter;
  private readonly orchestrator: DeployOrchestrator;

  constructor(
    private readonly settings: AppSettings,
    private readonly store: BootstrapStateStore,
    onStateChange: (state: BootstrapState) => void,
  ) {
    this.runtimeAdapter = new HermesRuntimeAdapter(settings, (stage, log) => {
      const currentState = this.orchestrator.current();
      const newState = addStageLog(currentState, stage, log);
      this.orchestrator.setState(newState); // 关键：更新 orchestrator 的状态
      this.store.setState(newState);
      onStateChange(newState);
    });

    const operations: BootstrapOperations = {
      precheck: async () => {
        setCurrentStage("precheck");
        return this.runtimeAdapter.precheck();
      },
      installPrerequisites: async () => {
        setCurrentStage("install_prerequisites");
        return this.runtimeAdapter.installPrerequisites();
      },
      installHermes: async () => {
        setCurrentStage("install_hermes");
        return this.runtimeAdapter.installHermes();
      },
      verifyHealth: async () => {
        setCurrentStage("verify_health");
        return this.runtimeAdapter.verifyHealth();
      },
    };

    this.orchestrator = new DeployOrchestrator(operations, (state) => {
      this.store.setState(state);
      onStateChange(state);
    }, this.store.getState());
  }

  current(): BootstrapState {
    return this.orchestrator.current();
  }

  async start(): Promise<BootstrapState> {
    return this.orchestrator.start();
  }

  async retry(): Promise<BootstrapState> {
    return this.orchestrator.retryCurrent();
  }

  async repair(): Promise<BootstrapState> {
    this.store.reset();
    return this.orchestrator.repair();
  }

  async ensureReadyForOpenWebui(): Promise<OperationResult> {
    const state = this.orchestrator.current();
    if (state.phase === "ready") {
      return {
        success: true,
        message: "安装流程已完成。",
      };
    }

    const result = await this.orchestrator.start();
    if (result.phase === "ready") {
      return {
        success: true,
        message: "安装流程已完成。",
      };
    }

    const failedStage = result.currentStage ?? "unknown";
    return {
      success: false,
      message: `当前阶段执行失败：${failedStage}`,
      errorCode: "bootstrap_not_ready",
    };
  }
}
