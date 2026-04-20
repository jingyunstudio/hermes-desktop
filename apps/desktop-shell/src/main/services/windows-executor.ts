import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execAsync = promisify(exec);

export interface ExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export class WindowsExecutorService {
  private allowedPaths: string[];

  constructor() {
    // 允许执行的路径白名单
    this.allowedPaths = [
      process.env.USERPROFILE || "",
      "C:\\Program Files",
      "C:\\Windows\\System32",
    ];
  }

  /**
   * 执行 Windows 命令
   */
  async executeCommand(command: string, cwd?: string): Promise<ExecutionResult> {
    try {
      // 安全检查：禁止危险命令
      if (this.isDangerousCommand(command)) {
        return {
          success: false,
          error: "Command not allowed for security reasons",
        };
      }

      // 执行命令
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.env.USERPROFILE,
        timeout: 30000, // 30秒超时
        maxBuffer: 1024 * 1024 * 10, // 10MB 输出限制
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout?.trim(),
        stderr: error.stderr?.trim(),
        exitCode: error.code,
        error: error.message,
      };
    }
  }

  /**
   * 执行 PowerShell 脚本
   */
  async executePowerShell(script: string, cwd?: string): Promise<ExecutionResult> {
    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`;
    return this.executeCommand(command, cwd);
  }

  /**
   * 打开文件或程序
   */
  async openFile(filePath: string): Promise<ExecutionResult> {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      // 使用 start 命令打开文件
      const command = `start "" "${filePath}"`;
      return this.executeCommand(command);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<ExecutionResult> {
    try {
      if (!this.isPathAllowed(filePath)) {
        return {
          success: false,
          error: "Access to this path is not allowed",
        };
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return {
        success: true,
        stdout: content,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    try {
      if (!this.isPathAllowed(filePath)) {
        return {
          success: false,
          error: "Access to this path is not allowed",
        };
      }

      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, "utf-8");
      return {
        success: true,
        stdout: `File written: ${filePath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string): Promise<ExecutionResult> {
    try {
      if (!this.isPathAllowed(dirPath)) {
        return {
          success: false,
          error: "Access to this path is not allowed",
        };
      }

      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = files.map((file) => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        isFile: file.isFile(),
      }));

      return {
        success: true,
        stdout: JSON.stringify(result, null, 2),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 检查路径是否在允许列表中
   */
  private isPathAllowed(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    return this.allowedPaths.some((allowedPath) =>
      normalizedPath.startsWith(path.normalize(allowedPath))
    );
  }

  /**
   * 检查是否为危险命令
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/[sq]/i,
      /format\s+/i,
      /shutdown/i,
      /restart/i,
      /reg\s+delete/i,
      /net\s+user/i,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }
}
