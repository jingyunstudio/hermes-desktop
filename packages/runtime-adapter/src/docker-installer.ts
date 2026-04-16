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
    if (!fs.existsSync(installerPath)) {
      log("错误: 安装包文件不存在");
      return {
        success: false,
        message: "安装包不存在",
        errorCode: "installer_not_found",
      };
    }

    const fileSize = fs.statSync(installerPath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    // 验证文件大小
    if (fileSize < this.MIN_INSTALLER_SIZE) {
      log(`错误: 安装包文件大小异常: ${fileSizeMB} MB`);
      log(`期望至少: ${(this.MIN_INSTALLER_SIZE / 1024 / 1024).toFixed(0)} MB`);
      log("文件可能已损坏或下载不完整");
      return {
        success: false,
        message: `安装包文件大小异常 (${fileSizeMB} MB)，可能已损坏`,
        errorCode: "installer_invalid",
      };
    }

    log(`准备安装 Docker Desktop`);
    log(`安装包路径: ${installerPath}`);
    log(`安装包大小: ${fileSizeMB} MB`);
    log("");
    log("启动 Docker Desktop 安装程序...");
    log("注意: 请按照安装向导完成安装");
    log("");

    const startTime = Date.now();

    // 直接运行安装程序，显示安装界面
    const result = await runCommand(installerPath, ["install"], this.INSTALL_TIMEOUT_MS);

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    log(`安装程序已退出，耗时: ${elapsedSeconds} 秒`);
    log(`退出码: ${result.code}`);

    // GUI 安装可能立即返回，需要检查 Docker 是否真的安装了
    log("");
    log("检查 Docker 是否安装成功...");
    log("提示: 请完成安装向导中的所有步骤");

    // 等待最多 5 分钟，检查 docker 命令是否可用
    const maxCheckTime = 300000; // 5 分钟
    const checkInterval = 5000; // 每 5 秒检查一次
    const checkStartTime = Date.now();
    let dockerInstalled = false;

    while (Date.now() - checkStartTime < maxCheckTime) {
      const elapsed = Math.round((Date.now() - checkStartTime) / 1000);
      log(`[检查 ${Math.floor(elapsed / 5) + 1}] 检测 docker 命令... (已等待 ${elapsed}s)`);

      const checkResult = await runCommand("docker", ["--version"], 5000);
      if (checkResult.code === 0) {
        dockerInstalled = true;
        log(`✓ Docker 已安装！版本: ${checkResult.stdout.trim()}`);
        break;
      }

      log(`Docker 命令尚不可用，继续等待...`);
      await sleep(checkInterval);
    }

    if (!dockerInstalled) {
      log("✗ 安装超时或未完成");
      log("可能原因:");
      log("1. 用户取消了安装");
      log("2. 安装过程中出现错误");
      log("3. 安装时间超过 5 分钟");
      return {
        success: false,
        message: "Docker Desktop 安装未完成。请检查是否取消了安装或遇到错误。",
        errorCode: "installation_failed",
      };
    }

    log("✓ Docker Desktop 安装成功！");
    log("尝试启动 Docker Desktop...");

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
    log("等待 Docker Desktop 启动...");
    log(`最大等待时间: ${maxWaitMs / 1000} 秒`);

    const startTime = Date.now();
    const checkInterval = 3000;
    let checkCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      checkCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log(`[检查 ${checkCount}] 执行 docker info 命令... (已等待 ${elapsed}s)`);

      const result = await runCommand("docker", ["info"]);
      if (result.code === 0) {
        log(`✓ Docker Desktop 已就绪！(耗时 ${elapsed}s)`);
        return {
          success: true,
          message: "Docker Desktop 已启动",
        };
      }

      log(`Docker 尚未就绪 (exit code: ${result.code})`);
      if (result.stderr) {
        log(`错误: ${result.stderr.substring(0, 100)}`);
      }

      log(`等待 ${checkInterval / 1000} 秒后重试...`);
      await sleep(checkInterval);
    }

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);
    log(`✗ Docker Desktop 启动超时 (等待了 ${totalSeconds}s)`);

    return {
      success: false,
      message: "Docker Desktop 启动超时。请手动启动 Docker Desktop 后重试。",
      errorCode: "docker_start_timeout",
    };
  }

  /**
   * 尝试启动 Docker Desktop
   */
  async startDockerDesktop(): Promise<DockerInstallResult> {
    log("尝试启动 Docker Desktop...");

    // 使用 Windows start 命令启动 Docker Desktop
    // start 命令会自动查找已安装的应用程序
    log("执行启动命令: start \"\" \"Docker Desktop\"");

    const result = await runCommand("cmd.exe", ["/c", "start", "", "Docker Desktop"], 10000);

    log(`启动命令返回，退出码: ${result.code}`);

    if (result.code === 0) {
      log("✓ Docker Desktop 启动命令已执行");
      return {
        success: true,
        message: "Docker Desktop 正在启动",
      };
    }

    // 如果 start 命令失败，尝试直接查找可执行文件
    log("start 命令失败，尝试查找可执行文件...");

    const possiblePaths = [
      "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
      "C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe",
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        log(`✓ 找到 Docker Desktop: ${p}`);
        log("直接启动可执行文件...");

        const execResult = await runCommand(p, [], 10000);

        if (execResult.code === 0 || (execResult.code === -1 && execResult.stderr.includes("timed out"))) {
          log("✓ Docker Desktop 启动命令已执行");
          return {
            success: true,
            message: "Docker Desktop 正在启动",
          };
        }
      }
    }

    log("✗ 无法启动 Docker Desktop");
    return {
      success: false,
      message: "无法启动 Docker Desktop",
      errorCode: "docker_start_failed",
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
    const readyResult = await this.waitForDockerReady(60000); // 等待 1 分钟
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
