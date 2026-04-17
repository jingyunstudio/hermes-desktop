import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { runCommand, sleep } from "./command";
import { log } from "./logger";

export interface DockerInstallResult {
  success: boolean;
  message: string;
  errorCode?: string;
  needsRestart?: boolean;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export class DockerInstaller {
  private readonly DOCKER_DESKTOP_URLS: string[];

  constructor() {
    // 从环境变量读取备用下载源
    const backupUrl = process.env.DOCKER_DESKTOP_BACKUP_URL;

    this.DOCKER_DESKTOP_URLS = [
      // Docker Desktop 4.33.1 (稳定版本，兼容性更好)
      "https://desktop.docker.com/win/main/amd64/161083/Docker%20Desktop%20Installer.exe",
      // 官方最新版下载地址
      "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe",
      // 国内镜像源
      "https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/Docker%20Desktop%20Installer.exe",
      "https://mirrors.cloud.tencent.com/docker-toolbox/windows/docker-desktop/Docker%20Desktop%20Installer.exe",
      "https://mirrors.ustc.edu.cn/docker-toolbox/windows/docker-desktop/Docker%20Desktop%20Installer.exe",
      "https://mirrors.tuna.tsinghua.edu.cn/docker-toolbox/windows/docker-desktop/Docker%20Desktop%20Installer.exe",
    ];

    // 如果配置了备用源，添加到列表末尾
    if (backupUrl) {
      this.DOCKER_DESKTOP_URLS.push(backupUrl);
    }
  }

  private readonly MIN_INSTALLER_SIZE = 400 * 1024 * 1024; // 400MB
  private readonly INSTALL_TIMEOUT_MS = 600000; // 10 minutes

  /**
   * 检查本地缓存
   */
  private checkLocalCache(downloadDir: string): string | null {
    const cachePaths = [
      // 应用下载目录
      path.join(downloadDir, "DockerDesktopInstaller.exe"),
      path.join(downloadDir, "Docker Desktop Installer.exe"),
      // 用户下载目录
      path.join(process.env.USERPROFILE || "", "Downloads", "Docker Desktop Installer.exe"),
      path.join(process.env.USERPROFILE || "", "Downloads", "DockerDesktopInstaller.exe"),
      // 桌面
      path.join(process.env.USERPROFILE || "", "Desktop", "Docker Desktop Installer.exe"),
      path.join(process.env.USERPROFILE || "", "Desktop", "DockerDesktopInstaller.exe"),
    ];

    for (const p of cachePaths) {
      if (fs.existsSync(p)) {
        const fileSize = fs.statSync(p).size;
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

        if (fileSize >= this.MIN_INSTALLER_SIZE) {
          log(`✓ 找到本地缓存: ${p}`);
          log(`  文件大小: ${fileSizeMB} MB`);
          return p;
        }
      }
    }

    return null;
  }

  /**
   * 下载 Docker Desktop 安装包
   */
  async downloadInstaller(
    downloadPath: string,
    onProgress?: ProgressCallback,
  ): Promise<{ success: boolean; message: string; filePath?: string }> {
    log("开始下载 Docker Desktop 安装包");
    log(`共有 ${this.DOCKER_DESKTOP_URLS.length} 个下载源可用`);

    for (let i = 0; i < this.DOCKER_DESKTOP_URLS.length; i++) {
      const url = this.DOCKER_DESKTOP_URLS[i];

      log(`[${i + 1}/${this.DOCKER_DESKTOP_URLS.length}] 尝试下载`);
      log(`URL: ${url}`);

      try {
        const result = await this.downloadFile(url, downloadPath, onProgress);
        if (result.success) {
          log(`✓ 下载成功！文件保存至: ${result.filePath}`);
          return result;
        }
        log(`✗ 下载失败: ${result.message}`);
      } catch (error) {
        log(`✗ 下载异常: ${error}`);
      }
    }

    log("所有下载源均失败");
    return {
      success: false,
      message: "所有下载源均失败。请检查网络连接或手动下载 Docker Desktop。",
    };
  }

  /**
   * 从指定 URL 下载文件
   */
  private async downloadFile(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback,
  ): Promise<{ success: boolean; message: string; filePath?: string }> {
    return new Promise((resolve) => {
      const file = fs.createWriteStream(destPath);
      let downloaded = 0;
      let total = 0;
      let lastLogTime = 0;

      log("发起 HTTPS 请求...");

      const request = https.get(url, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            log(`收到重定向: ${redirectUrl}`);
            file.close();
            try {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
            } catch (error) {
              // 忽略删除错误
            }
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          log(`HTTP 错误: ${response.statusCode}`);
          file.close();
          try {
            if (fs.existsSync(destPath)) {
              fs.unlinkSync(destPath);
            }
          } catch (error) {
            // 忽略删除错误
          }
          resolve({
            success: false,
            message: `HTTP ${response.statusCode}`,
          });
          return;
        }

        total = Number.parseInt(response.headers["content-length"] || "0", 10);
        const totalMB = (total / 1024 / 1024).toFixed(2);

        log(`连接成功！文件大小: ${totalMB} MB`);
        log("开始下载...");

        response.on("data", (chunk) => {
          downloaded += chunk.length;
          const now = Date.now();

          // 每秒输出一次日志，避免日志过多
          if (now - lastLogTime > 1000) {
            const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
            const percentage = total > 0 ? Math.round((downloaded / total) * 100) : 0;
            log(`下载中: ${downloadedMB} MB / ${totalMB} MB (${percentage}%)`);
            lastLogTime = now;
          }

          if (onProgress && total > 0) {
            onProgress({
              downloaded,
              total,
              percentage: Math.round((downloaded / total) * 100),
            });
          }
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          const finalMB = (downloaded / 1024 / 1024).toFixed(2);

          log(`下载完成！总计: ${finalMB} MB`);

          // 验证文件大小
          if (downloaded < this.MIN_INSTALLER_SIZE) {
            log(`✗ 文件大小异常: ${finalMB} MB (期望至少 ${(this.MIN_INSTALLER_SIZE / 1024 / 1024).toFixed(0)} MB)`);
            log("可能下载到了错误页面或文件已损坏");
            try {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
            } catch (error) {
              // 忽略删除错误
            }
            resolve({
              success: false,
              message: `文件大小异常 (${finalMB} MB)`,
            });
            return;
          }

          resolve({
            success: true,
            message: "下载完成",
            filePath: destPath,
          });
        });
      });

      request.on("error", (error) => {
        log(`网络错误: ${error.message}`);
        file.close();
        try {
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
        } catch (err) {
          // 忽略删除错误
        }
        resolve({
          success: false,
          message: error.message,
        });
      });

      request.setTimeout(60000, () => {
        log("下载超时（60秒无响应）");
        request.destroy();
        file.close();
        try {
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
        } catch (error) {
          // 忽略删除错误
        }
        resolve({
          success: false,
          message: "下载超时",
        });
      });
    });
  }

  /**
   * 安装 Docker Desktop
   */
  async install(installerPath: string): Promise<DockerInstallResult> {
    log("=== 开始安装 Docker Desktop ===");

    // 步骤 1: 验证安装包文件
    log("步骤 1: 验证安装包文件");
    log(`检查路径: ${installerPath}`);
    
    if (!fs.existsSync(installerPath)) {
      log(`✗ 文件不存在: ${installerPath}`);
      log("可能原因:");
      log("  1. 下载失败或未完成");
      log("  2. 文件被删除或移动");
      log("  3. 路径错误");
      return {
        success: false,
        message: `安装包文件不存在: ${installerPath}`,
        errorCode: "installer_not_found",
      };
    }
    log(`✓ 文件存在`);

    const fileSize = fs.statSync(installerPath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    log(`文件大小: ${fileSizeMB} MB`);

    // 验证文件大小
    const minSizeMB = (this.MIN_INSTALLER_SIZE / 1024 / 1024).toFixed(0);
    if (fileSize < this.MIN_INSTALLER_SIZE) {
      log(`✗ 文件大小异常: ${fileSizeMB} MB (期望至少 ${minSizeMB} MB)`);
      log("可能原因:");
      log("  1. 下载不完整");
      log("  2. 文件已损坏");
      log("  3. 下载的不是完整安装包");
      return {
        success: false,
        message: `安装包文件大小异常 (${fileSizeMB} MB，期望至少 ${minSizeMB} MB)，可能已损坏或下载不完整`,
        errorCode: "installer_invalid",
      };
    }
    log(`✓ 文件大小正常`);

    // 步骤 2: 执行安装
    log("");
    log("步骤 2: 执行安装程序");
    log(`命令: ${installerPath} install`);
    log(`超时时间: ${this.INSTALL_TIMEOUT_MS / 1000} 秒`);
    log("注意: 请按照安装向导完成安装");
    log("");

    const startTime = Date.now();

    // 直接运行安装程序，显示安装界面
    const result = await runCommand(installerPath, ["install"], this.INSTALL_TIMEOUT_MS);

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    log(`安装程序已退出`);
    log(`  耗时: ${elapsedSeconds} 秒`);
    log(`  退出码: ${result.code}`);
    
    if (result.stdout) {
      log(`  标准输出: ${result.stdout.trim().substring(0, 200)}`);
    }
    if (result.stderr) {
      log(`  标准错误: ${result.stderr.trim().substring(0, 200)}`);
    }

    // 步骤 3: 验证安装结果
    log("");
    log("步骤 3: 验证 Docker 是否安装成功");
    log("提示: 请确保完成了安装向导中的所有步骤");

    // 等待最多 5 分钟，检查 docker 命令是否可用
    const maxCheckTime = 300000; // 5 分钟
    const checkInterval = 5000; // 每 5 秒检查一次
    const checkStartTime = Date.now();
    let dockerInstalled = false;
    let checkCount = 0;

    while (Date.now() - checkStartTime < maxCheckTime) {
      checkCount++;
      const elapsed = Math.round((Date.now() - checkStartTime) / 1000);
      log(`[验证 ${checkCount}] 执行命令: docker --version (已等待 ${elapsed}s / ${maxCheckTime / 1000}s)`);

      const checkResult = await runCommand("docker", ["--version"], 5000);
      
      if (checkResult.code === 0) {
        dockerInstalled = true;
        const version = checkResult.stdout.trim();
        log(`✓ Docker 已成功安装！`);
        log(`  版本: ${version}`);
        break;
      }

      log(`✗ docker 命令不可用 (退出码: ${checkResult.code})`);
      if (checkResult.stderr) {
        log(`  错误: ${checkResult.stderr.trim().substring(0, 100)}`);
      }
      
      const remainingTime = Math.round((maxCheckTime - (Date.now() - checkStartTime)) / 1000);
      log(`继续等待... (剩余时间: ${remainingTime}s)`);
      await sleep(checkInterval);
    }

    if (!dockerInstalled) {
      const totalWaitTime = Math.round((Date.now() - checkStartTime) / 1000);
      log(`✗ 安装验证失败 (等待了 ${totalWaitTime}s)`);
      log("可能原因:");
      log("  1. 用户取消了安装");
      log("  2. 安装过程中出现错误");
      log("  3. 安装时间超过 5 分钟");
      log("  4. Docker 未添加到系统 PATH");
      log("  5. 需要重启系统以完成安装");
      log("建议操作:");
      log("  1. 检查是否有安装错误提示");
      log("  2. 尝试手动运行安装包");
      log("  3. 重启系统后重试");
      return {
        success: false,
        message: "Docker Desktop 安装未完成或验证失败。请检查是否取消了安装或遇到错误。",
        errorCode: "installation_failed",
      };
    }

    log("✓ Docker Desktop 安装验证成功！");

    return {
      success: true,
      message: "Docker Desktop 安装成功",
      needsRestart: false,
    };
  }

  /**
   * 等待 Docker Desktop 启动
   */
  async waitForDockerReady(maxWaitMs = 120000): Promise<DockerInstallResult> {
    log("=== 等待 Docker daemon 就绪 ===");
    log(`最大等待时间: ${maxWaitMs / 1000} 秒`);
    log(`检查间隔: 3 秒`);

    const startTime = Date.now();
    const checkInterval = 3000;
    let checkCount = 0;
    let lastErrorType = "";

    while (Date.now() - startTime < maxWaitMs) {
      checkCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log(`[检查 ${checkCount}] 执行命令: docker info (已等待 ${elapsed}s / ${maxWaitMs / 1000}s)`);

      const result = await runCommand("docker", ["info"]);
      
      if (result.code === 0) {
        log(`✓ Docker daemon 已就绪！(总耗时 ${elapsed}s, 检查次数 ${checkCount})`);
        return {
          success: true,
          message: "Docker Desktop 已启动",
        };
      }

      // 详细记录失败信息
      log(`✗ Docker daemon 未就绪 (退出码: ${result.code})`);
      
      if (result.stderr) {
        const errorMsg = result.stderr.substring(0, 300);
        log(`错误输出: ${errorMsg}`);
        
        // 检测常见错误并提供提示
        let currentErrorType = "unknown";
        if (errorMsg.includes("daemon is not running") || errorMsg.includes("Cannot connect to the Docker daemon")) {
          currentErrorType = "daemon_not_running";
          if (lastErrorType !== currentErrorType) {
            log("诊断: Docker daemon 未运行");
            log("  - Docker Desktop 进程可能正在启动中");
            log("  - 或者 Docker Desktop 启动失败");
          }
        } else if (errorMsg.toLowerCase().includes("wsl")) {
          currentErrorType = "wsl_issue";
          if (lastErrorType !== currentErrorType) {
            log("诊断: WSL2 相关问题");
            log("  - WSL2 可能未正确安装或配置");
            log("  - 可能需要重启系统以完成 WSL2 配置");
            log("  - 建议: 运行 'wsl --status' 检查 WSL2 状态");
          }
        } else if (errorMsg.includes("permission denied") || errorMsg.includes("access denied")) {
          currentErrorType = "permission_denied";
          if (lastErrorType !== currentErrorType) {
            log("诊断: 权限问题");
            log("  - 可能需要管理员权限");
            log("  - Docker Desktop 服务可能未正确启动");
          }
        } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
          currentErrorType = "timeout";
          if (lastErrorType !== currentErrorType) {
            log("诊断: 连接超时");
            log("  - Docker daemon 响应缓慢");
            log("  - 系统资源可能不足");
          }
        } else if (errorMsg.includes("context deadline exceeded")) {
          currentErrorType = "context_deadline";
          if (lastErrorType !== currentErrorType) {
            log("诊断: Docker daemon 启动中但响应缓慢");
            log("  - 继续等待，daemon 可能正在初始化");
          }
        } else {
          if (lastErrorType !== currentErrorType) {
            log("诊断: 未知错误类型");
            log("  - 建议查看 Docker Desktop 日志");
            log("  - 日志位置: %LOCALAPPDATA%\\Docker\\log.txt");
          }
        }
        lastErrorType = currentErrorType;
      } else if (result.stdout) {
        log(`标准输出: ${result.stdout.substring(0, 200)}`);
      } else {
        log("无错误输出，可能是命令执行失败");
        log("  - 检查 docker 命令是否在 PATH 中");
        log("  - 检查 Docker Desktop 是否正确安装");
      }

      const remainingTime = Math.round((maxWaitMs - (Date.now() - startTime)) / 1000);
      log(`等待 ${checkInterval / 1000} 秒后重试... (剩余时间: ${remainingTime}s)`);
      await sleep(checkInterval);
    }

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);
    log(`✗ Docker daemon 启动超时 (总等待时间: ${totalSeconds}s, 检查次数: ${checkCount})`);
    log("超时原因分析:");
    log("  1. Docker Desktop 启动时间过长（低配置机器常见）");
    log("  2. WSL2 未正确配置，需要重启系统");
    log("  3. Docker Desktop 启动失败，需要查看日志");
    log("  4. 系统资源不足（内存、CPU）");
    log("  5. 防火墙或安全软件阻止");
    log("建议操作:");
    log("  1. 重启系统后重试");
    log("  2. 手动启动 Docker Desktop 查看错误信息");
    log("  3. 查看日志: %LOCALAPPDATA%\\Docker\\log.txt");
    log("  4. 运行 'wsl --status' 检查 WSL2 状态");

    return {
      success: false,
      message: `Docker Desktop 启动超时（等待了 ${totalSeconds}s）。请重启系统或手动启动 Docker Desktop 后重试。`,
      errorCode: "docker_start_timeout",
    };
  }

  /**
   * 检查 Docker Desktop 进程是否在运行
   */
  private async isDockerDesktopRunning(): Promise<boolean> {
    const result = await runCommand("tasklist", ["/FI", "IMAGENAME eq Docker Desktop.exe"], 5000);
    const isRunning = result.code === 0 && result.stdout.includes("Docker Desktop.exe");
    log(`进程检查: ${isRunning ? "运行中" : "未运行"} (tasklist 返回码: ${result.code})`);
    return isRunning;
  }

  /**
   * 尝试启动 Docker Desktop
   */
  async startDockerDesktop(): Promise<DockerInstallResult> {
    log("=== 开始启动 Docker Desktop ===");

    // 先检查是否已经在运行
    log("步骤 1: 检查 Docker Desktop 进程状态");
    if (await this.isDockerDesktopRunning()) {
      log("✓ Docker Desktop 进程已在运行，无需启动");
      return {
        success: true,
        message: "Docker Desktop 已在运行",
      };
    }
    log("Docker Desktop 进程未运行，需要启动");

    // 使用 Windows start 命令启动 Docker Desktop
    // start 命令会自动查找已安装的应用程序
    log("步骤 2: 使用 Windows start 命令启动");
    log("执行命令: cmd.exe /c start \"\" \"Docker Desktop\"");

    const result = await runCommand("cmd.exe", ["/c", "start", "", "Docker Desktop"], 10000);

    log(`命令执行完成 - 退出码: ${result.code}`);
    if (result.stdout) {
      log(`标准输出: ${result.stdout.trim()}`);
    }
    if (result.stderr) {
      log(`标准错误: ${result.stderr.trim()}`);
    }

    // 等待进程启动（最多 30 秒）
    log("步骤 3: 验证进程是否启动");
    const maxWait = 30000;
    const checkInterval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      if (await this.isDockerDesktopRunning()) {
        log(`✓ Docker Desktop 进程已成功启动 (耗时 ${elapsed / 1000}s)`);
        return {
          success: true,
          message: "Docker Desktop 正在启动",
        };
      }
      elapsed += checkInterval;
      if (elapsed < maxWait) {
        log(`等待进程启动... (${elapsed / 1000}s / ${maxWait / 1000}s)`);
        await sleep(checkInterval);
      }
    }

    log(`✗ start 命令执行后进程未启动 (等待了 ${maxWait / 1000}s)`);

    // 如果 start 命令失败，尝试直接查找可执行文件
    log("步骤 4: 尝试直接执行可执行文件");

    const possiblePaths = [
      "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
      "C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe",
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    ];

    log(`检查 ${possiblePaths.length} 个可能的安装路径...`);

    let foundPath: string | null = null;
    for (const p of possiblePaths) {
      log(`检查路径: ${p}`);
      if (fs.existsSync(p)) {
        log(`✓ 找到可执行文件: ${p}`);
        foundPath = p;
        break;
      } else {
        log(`✗ 文件不存在: ${p}`);
      }
    }

    if (!foundPath) {
      log("✗ 未找到 Docker Desktop 可执行文件");
      log("可能的原因:");
      log("  1. Docker Desktop 未正确安装");
      log("  2. 安装在非标准路径");
      log("  3. 安装过程未完成");
      return {
        success: false,
        message: "未找到 Docker Desktop 可执行文件，请检查安装是否完成",
        errorCode: "docker_executable_not_found",
      };
    }

    log(`尝试直接执行: ${foundPath}`);
    const execResult = await runCommand(foundPath, [], 10000);
    log(`执行结果 - 退出码: ${execResult.code}`);
    if (execResult.stdout) {
      log(`标准输出: ${execResult.stdout.trim()}`);
    }
    if (execResult.stderr) {
      log(`标准错误: ${execResult.stderr.trim()}`);
    }

    // 再次等待进程启动
    log("步骤 5: 再次验证进程是否启动");
    elapsed = 0;
    while (elapsed < maxWait) {
      if (await this.isDockerDesktopRunning()) {
        log(`✓ Docker Desktop 进程已成功启动 (耗时 ${elapsed / 1000}s)`);
        return {
          success: true,
          message: "Docker Desktop 正在启动",
        };
      }
      elapsed += checkInterval;
      if (elapsed < maxWait) {
        log(`等待进程启动... (${elapsed / 1000}s / ${maxWait / 1000}s)`);
        await sleep(checkInterval);
      }
    }

    log(`✗ 直接执行后进程仍未启动 (等待了 ${maxWait / 1000}s)`);
    log("可能的原因:");
    log("  1. 需要管理员权限");
    log("  2. WSL2 未正确配置");
    log("  3. 系统需要重启");
    log("  4. 防火墙或安全软件阻止");
    log("  5. 系统资源不足");

    return {
      success: false,
      message: "Docker Desktop 可执行文件存在但无法启动进程，可能需要管理员权限或系统重启",
      errorCode: "docker_process_start_failed",
    };
  }

  /**
   * 完整的自动安装流程
   */
  async autoInstall(
    downloadDir: string,
    onProgress?: ProgressCallback,
  ): Promise<DockerInstallResult> {
    // 确保下载目录存在
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const installerPath = path.join(downloadDir, "DockerDesktopInstaller.exe");

    // 0. 检查本地缓存
    log("检查本地缓存...");
    const cachedPath = this.checkLocalCache(downloadDir);

    if (cachedPath) {
      log("✓ 使用本地缓存，跳过下载");
      // 如果缓存路径不是目标路径，复制过去
      if (cachedPath !== installerPath) {
        log(`复制文件: ${path.basename(cachedPath)} -> ${path.basename(installerPath)}`);
        fs.copyFileSync(cachedPath, installerPath);
      }
    } else {
      log("未找到本地缓存");

      // 1. 下载安装包
      log("步骤 1/3: 下载 Docker Desktop");
      const downloadResult = await this.downloadInstaller(installerPath, onProgress);
      if (!downloadResult.success) {
        return {
          success: false,
          message: `下载失败: ${downloadResult.message}`,
          errorCode: "download_failed",
        };
      }
    }

    // 2. 安装
    log("步骤 2/3: 安装 Docker Desktop");
    const installResult = await this.install(installerPath);
    if (!installResult.success) {
      return installResult;
    }

    // 3. 尝试启动 Docker Desktop
    log("步骤 3/3: 启动 Docker Desktop");
    const startResult = await this.startDockerDesktop();
    if (!startResult.success) {
      log("✗ 无法启动 Docker Desktop");
      log("可能需要重启系统以完成 WSL2 配置");
      return {
        success: true,
        message: "Docker Desktop 已安装，但无法启动。请重启系统后再次运行本应用。",
        needsRestart: true,
      };
    }

    // 4. 等待 Docker 就绪
    log("等待 Docker Desktop 启动...");
    const readyResult = await this.waitForDockerReady(180000); // 等待 3 分钟（首次安装需要更多时间）
    if (!readyResult.success) {
      log("✗ Docker Desktop 启动超时");
      log("可能需要重启系统以完成 WSL2 配置");
      return {
        success: true,
        message: "Docker Desktop 已安装，但启动超时。请重启系统后再次运行本应用。",
        needsRestart: true,
      };
    }

    log("✓ Docker Desktop 已就绪，无需重启！");

    // 清理安装包
    try {
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
        log("已清理安装包");
      }
    } catch (error) {
      log(`清理安装包失败: ${error}`);
    }

    return {
      success: true,
      message: "Docker Desktop 安装并启动成功",
    };
  }
}
