import { spawn } from "node:child_process";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type StreamCallback = (data: string) => void;

export async function runCommand(command: string, args: string[], timeoutMs?: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutHandle = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            if (!child.killed) {
              child.kill("SIGKILL");
            }
          }, 5000);
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({ code: -1, stdout, stderr: error.message });
    });

    child.on("close", (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (timedOut) {
        resolve({ code: -1, stdout, stderr: `Command timed out after ${timeoutMs}ms` });
      } else {
        resolve({ code: code ?? -1, stdout, stderr });
      }
    });
  });
}

/**
 * 运行命令并实时输出流
 */
export async function runCommandWithStream(
  command: string,
  args: string[],
  onStdout?: StreamCallback,
  onStderr?: StreamCallback,
  timeoutMs?: number,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutHandle = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            if (!child.killed) {
              child.kill("SIGKILL");
            }
          }, 5000);
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      const data = String(chunk);
      stdout += data;
      if (onStdout) {
        onStdout(data);
      }
    });

    child.stderr.on("data", (chunk) => {
      const data = String(chunk);
      stderr += data;
      if (onStderr) {
        onStderr(data);
      }
    });

    child.on("error", (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({ code: -1, stdout, stderr: error.message });
    });

    child.on("close", (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (timedOut) {
        resolve({ code: -1, stdout, stderr: `Command timed out after ${timeoutMs}ms` });
      } else {
        resolve({ code: code ?? -1, stdout, stderr });
      }
    });
  });
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
