# Docker 自动安装功能

## 概述

Hermes Desktop 现在支持自动检测并安装 Docker Desktop，无需用户手动下载和安装。

## 工作流程

### 1. 自动检测

应用启动时会自动检测 Docker 是否已安装：

```typescript
const dockerManager = new DockerManager();
const isInstalled = await dockerManager.isInstalled();
```

### 2. 自动下载

如果未检测到 Docker，会从以下镜像源自动下载安装包：

1. **阿里云镜像**（优先）：`https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/`
2. **官方源**（备用）：`https://desktop.docker.com/win/main/amd64/`

下载过程支持进度回调：

```typescript
dockerManager.setDownloadProgressCallback((progress) => {
  console.log(`下载进度: ${progress.percentage}%`);
  console.log(`已下载: ${progress.downloaded} / ${progress.total} 字节`);
});
```

### 3. 静默安装

下载完成后自动执行静默安装：

```bash
DockerDesktopInstaller.exe install --quiet --accept-license
```

安装参数说明：
- `install`: 安装模式
- `--quiet`: 静默安装，不显示 UI
- `--accept-license`: 自动接受许可协议

### 4. 自动启动

安装完成后自动启动 Docker Desktop：

```typescript
const startResult = await dockerManager.installer.startDockerDesktop();
```

应用会查找以下路径的 Docker Desktop 可执行文件：
- `C:\Program Files\Docker\Docker\Docker Desktop.exe`
- `C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe`

### 5. 等待就绪

启动后等待 Docker 服务完全就绪（最多 2 分钟）：

```typescript
const readyResult = await dockerManager.installer.waitForDockerReady(120000);
```

每 3 秒检查一次 `docker info` 命令是否成功。

## 使用方式

### 基本用法

```typescript
import { DockerManager } from "@hermes-desktop/runtime-adapter";

const dockerManager = new DockerManager();

// 自动安装（默认启用）
const result = await dockerManager.ensureReady(true);

if (result.success) {
  console.log("Docker 已就绪");
} else if (result.needsRestart) {
  console.log("需要重启系统:", result.message);
} else {
  console.error("安装失败:", result.message);
}
```

### 禁用自动安装

如果只想检测而不自动安装：

```typescript
const result = await dockerManager.ensureReady(false);
```

### 监听下载进度

```typescript
dockerManager.setDownloadProgressCallback((progress) => {
  // 更新 UI 进度条
  updateProgressBar(progress.percentage);
});

await dockerManager.ensureReady(true);
```

## 错误处理

### 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `docker_not_found` | 未检测到 Docker（禁用自动安装时） | 手动安装或启用自动安装 |
| `download_failed` | 下载失败 | 检查网络连接或手动下载 |
| `auto_install_failed` | 自动安装失败 | 查看详细错误信息 |
| `installation_failed` | 安装程序执行失败 | 检查管理员权限 |
| `needs_system_restart` | 需要重启系统 | 重启后再次运行 |
| `docker_daemon_not_ready` | Docker 服务未就绪 | 手动启动 Docker Desktop |
| `docker_start_timeout` | Docker 启动超时 | 手动启动或检查系统资源 |

### 错误处理示例

```typescript
const result = await dockerManager.ensureReady(true);

switch (result.errorCode) {
  case "needs_system_restart":
    showRestartDialog(result.message);
    break;
  
  case "download_failed":
    showManualDownloadDialog();
    break;
  
  case "docker_start_timeout":
    showRetryDialog("Docker 启动超时，请稍后重试");
    break;
  
  default:
    if (!result.success) {
      showErrorDialog(result.message);
    }
}
```

## 系统要求

- **操作系统**：Windows 10/11（64位）
- **磁盘空间**：至少 4GB 可用空间（Docker Desktop 安装包约 500MB，安装后约 2-3GB）
- **内存**：建议 4GB 以上
- **权限**：需要管理员权限进行安装
- **网络**：下载安装包需要网络连接（约 500MB）

## 注意事项

1. **管理员权限**：Docker Desktop 安装需要管理员权限，应用可能会弹出 UAC 提示
2. **系统重启**：某些情况下（如首次安装 WSL2）可能需要重启系统
3. **防火墙**：确保防火墙允许下载和安装
4. **杀毒软件**：某些杀毒软件可能会拦截安装程序
5. **磁盘空间**：确保系统盘有足够空间

## 手动安装备选方案

如果自动安装失败，用户可以手动安装：

1. 从以下地址下载 Docker Desktop：
   - 官方：https://www.docker.com/products/docker-desktop/
   - 阿里云：https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/

2. 双击安装包，按提示完成安装

3. 启动 Docker Desktop

4. 重新运行 Hermes Desktop

## 技术实现

### 核心类

- **DockerInstaller**：负责下载和安装 Docker Desktop
- **DockerManager**：管理 Docker 环境，集成自动安装功能

### 关键文件

- `packages/runtime-adapter/src/docker-installer.ts`：安装器实现
- `packages/runtime-adapter/src/docker.ts`：Docker 管理器
- `packages/runtime-adapter/src/index.ts`：对外导出接口

### 安装流程图

```
开始
  ↓
检测 Docker 是否已安装
  ↓
[否] → 下载安装包（多镜像源重试）
  ↓
执行静默安装
  ↓
[需要重启?] → 提示用户重启
  ↓
[否] → 启动 Docker Desktop
  ↓
等待 Docker 服务就绪（轮询 docker info）
  ↓
[是] → Docker 已安装
  ↓
检查 Docker 服务是否运行
  ↓
[否] → 启动 Docker Desktop → 等待就绪
  ↓
[是] → 完成
```

## 未来改进

- [ ] 支持 macOS 和 Linux 自动安装
- [ ] 支持自定义下载镜像源
- [ ] 支持断点续传
- [ ] 支持安装特定版本的 Docker Desktop
- [ ] 支持卸载功能
- [ ] 添加安装日志记录
