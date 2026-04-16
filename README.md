# Hermes Desktop

一键部署 Hermes Agent + Open WebUI 的桌面应用，专为国内网络环境优化。

## 项目目的

Hermes Desktop 旨在为不熟悉命令行的用户提供一键安装体验，让任何人都能轻松部署和使用 Hermes Agent。

**核心目标：**
- 🎯 **零门槛部署**：无需懂 Docker 命令、无需配置环境变量，双击安装即可
- 🔗 **开箱即用**：自动对接 Open WebUI，提供完整的 AI 对话界面
- 🇨🇳 **国内优化**：针对国内网络环境优化，内置多个镜像源自动切换
- 🤖 **自动化**：从 Docker 安装到服务部署，全程自动化，无需人工干预

## 特性

- 🚀 **一键部署**：自动完成环境检测、Docker 安装、容器部署、健康检查
- 🔧 **自动安装 Docker**：未检测到 Docker 时自动下载并安装 Docker Desktop
- 🌐 **国内优化**：内置多个国内镜像源，自动切换
- 🔄 **智能重试**：多镜像源自动切换，网络错误快速跳过
- 📊 **实时反馈**：可视化部署进度，显示完整拉取日志

## 快速开始

1. 下载安装包：`Hermes-Desktop-Setup-{version}.exe`
2. 双击安装
3. 应用会自动从国内镜像源拉取 Docker 镜像
4. 等待部署完成后开始使用

## 前置要求

- **操作系统**：Windows 10/11（macOS 和 Linux 支持开发中）
- **Docker Desktop**：
  - 如果未安装，应用会自动下载并安装 Docker Desktop
  - 也可以手动预先安装：
    - 官方下载：https://www.docker.com/products/docker-desktop/
    - 国内镜像：https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/

## 部署流程

应用启动后会自动执行以下 5 个阶段：

1. **环境检测**：检查操作系统和 Docker 环境
2. **安装必备环境**：
   - 如果未检测到 Docker，自动下载并安装 Docker Desktop
   - 如果 Docker 已安装但未启动，自动启动 Docker Desktop
   - 等待 Docker 服务就绪
3. **安装 Hermes Agent**：部署 Hermes 容器（端口 8642）
4. **安装 Open WebUI**：部署 Open WebUI 容器（端口 3004）
5. **健康检查**：验证所有服务正常运行

部署完成后，可以通过以下地址访问：

- **Open WebUI**：http://127.0.0.1:3004
- **Hermes API**：http://127.0.0.1:8642

## 国内网络优化

### 内置镜像源（按优先级）

应用已内置以下国内镜像源，会自动按顺序尝试：

1. 阿里云镜像加速：`registry.cn-hangzhou.aliyuncs.com`
2. 腾讯云镜像加速：`ccr.ccs.tencentyun.com`
3. DaoCloud 镜像加速：`docker.m.daocloud.io`
4. 中科大镜像：`docker.mirrors.ustc.edu.cn`
5. 网易镜像：`hub-mirror.c.163.com`
6. 官方源（备用）：`ghcr.io`、`docker.io`

### 配置 Docker 镜像加速器（可选）

如果在线安装仍然较慢，可以配置 Docker 镜像加速器：

1. 打开 Docker Desktop
2. 进入 Settings → Docker Engine
3. 添加以下配置：

```json
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://ccr.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ]
}
```

4. 点击 Apply & Restart

详细说明请参考：[国内镜像源配置指南](docs/MIRROR_SOURCES.md)

## 常见问题

### Q: 没有安装 Docker 怎么办？

**A:** 应用会自动检测并安装 Docker Desktop：

1. 首次运行时，如果未检测到 Docker，会自动下载安装包
2. 下载完成后自动静默安装
3. 安装完成后自动启动 Docker Desktop
4. 如果需要重启系统，会提示用户重启后再次运行

如果自动安装失败，可以手动下载安装：
- 官方下载：https://www.docker.com/products/docker-desktop/
- 国内镜像：https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/

### Q: 镜像拉取失败怎么办？

**A:** 按以下顺序尝试：

1. **使用离线安装包**（推荐）
2. 检查 Docker Desktop 是否正常运行
3. 配置 Docker 镜像加速器（见上文）
4. 点击"重试当前步骤"或"一键修复"
5. 检查网络连接和防火墙设置

### Q: 部署卡在某个阶段怎么办？

**A:** 

1. 查看错误信息和错误码
2. 点击"重试当前步骤"
3. 如果多次重试失败，点击"一键修复"重置状态
4. 检查 Docker Desktop 日志

### Q: 如何手动预拉取镜像？

**A:** 在命令行执行：

```bash
# 拉取 Hermes Agent
docker pull registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
docker tag registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest ghcr.io/nousresearch/hermes-agent:latest

# 拉取 Open WebUI
docker pull registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main
docker tag registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main ghcr.io/open-webui/open-webui:main
```

然后启动 Hermes Desktop，会自动使用本地镜像。

## 开发

### 环境要求

- Node.js 18+
- pnpm 9+
- Docker Desktop

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
# 构建所有包
pnpm build

# 打包 Windows 版
pnpm package:win
```

### 项目结构

```
hermes-desktop/
├── apps/
│   └── desktop-shell/          # Electron 主应用
│       ├── src/
│       │   ├── main/           # Electron 主进程
│       │   ├── preload/        # 预加载脚本
│       │   └── renderer/       # React 前端
├── packages/
│   ├── deploy-engine/          # 部署编排引擎
│   ├── runtime-adapter/        # Docker 运行时适配器
│   └── shared-types/           # 共享类型定义
├── build/                      # electron-builder 配置
├── scripts/                    # 构建脚本
└── resources/                  # 资源文件
```

## 技术栈

- **框架**：Electron 33 + React 19
- **构建**：Vite 5 + TypeScript 5
- **打包**：electron-builder 25
- **Monorepo**：pnpm workspace + Turbo
- **容器**：Docker + Docker Compose

## 路线图

- [x] Windows 一键部署
- [x] 国内镜像源优化
- [x] 自动安装 Docker Desktop
- [x] 实时部署日志显示
- [ ] macOS 支持
- [ ] Linux 支持
- [ ] 配置管理界面
- [ ] 容器管理功能（停止/重启/查看日志）
- [ ] 自动更新检查
- [ ] 多语言支持

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，欢迎通过 Issue 反馈。
