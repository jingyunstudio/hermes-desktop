import { BootstrapStage } from "@hermes-desktop/shared-types";

export type LogCallback = (stage: BootstrapStage, log: string) => void;

let currentStage: BootstrapStage | null = null;
let logCallback: LogCallback | null = null;

export function setCurrentStage(stage: BootstrapStage | null) {
  currentStage = stage;
}

export function setLogCallback(callback: LogCallback | null) {
  logCallback = callback;
}

export function log(message: string) {
  console.log(message);
  if (currentStage && logCallback) {
    logCallback(currentStage, message);
  }
}
