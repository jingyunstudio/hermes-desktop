import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { BootstrapState } from "@hermes-desktop/shared-types";
import { createInitialBootstrapState } from "@hermes-desktop/deploy-engine";

export class BootstrapStateStore {
  private readonly stateFilePath: string;

  constructor() {
    this.stateFilePath = path.join(app.getPath("userData"), "bootstrap-state.json");
  }

  getState(): BootstrapState {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return createInitialBootstrapState();
      }

      const raw = fs.readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw) as BootstrapState;

      // 兼容旧版本：确保 logs 数组存在
      if (!parsed.logs) {
        parsed.logs = [];
      }

      return parsed;
    } catch {
      return createInitialBootstrapState();
    }
  }

  setState(state: BootstrapState): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), "utf-8");
    } catch {
      // ignore persistence failure, runtime keeps working in-memory via orchestrator
    }
  }

  reset(): BootstrapState {
    const initial = createInitialBootstrapState();
    this.setState(initial);
    return initial;
  }
}
