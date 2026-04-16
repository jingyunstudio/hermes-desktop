# 本地开发配置说明

## 概述

为了保护私有资源（如私有镜像仓库、API Key 等），项目使用 `.env.local` 文件来存储本地配置。这个文件不会被提交到 Git 仓库。

## 配置步骤

1. 复制示例配置文件：
   ```bash
   cp .env.example .env.local
   ```

2. 编辑 `.env.local`，填入你的私有配置：
   ```bash
   # Docker 镜像源配置（可选）
   HERMES_IMAGE=your-registry.com/hermes-agent:latest
   OPENWEBUI_IMAGE=your-registry.com/open-webui:main

   # Docker Desktop 下载备用源（可选）
   DOCKER_DESKTOP_BACKUP_URL=https://your-cdn.com/Docker%20Desktop%20Installer.exe

   # OpenRouter API Key（用于测试，可选）
   OPENROUTER_API_KEY=sk-your-api-key
   ```

## 配置说明

### HERMES_IMAGE 和 OPENWEBUI_IMAGE

如果你有私有镜像仓库（如阿里云 ACR），可以配置这两个变量。应用会优先使用这些镜像源。

留空则使用公共镜像源（DaoCloud、阿里云等镜像加速）。

### DOCKER_DESKTOP_BACKUP_URL

如果你有 Docker Desktop 安装包的备用下载地址（如 OSS），可以配置此变量。

应用会在所有公共镜像源失败后尝试此地址。

### OPENROUTER_API_KEY

用于测试 Hermes Agent 的 API Key。生产环境应该让用户在配置面板中输入。

## 使用方式

配置文件会在以下场景自动生效：

1. **开发模式**：`pnpm dev`
2. **构建**：`pnpm build`
3. **打包**：`pnpm package:win`

环境变量会被注入到：
- Electron 主进程
- Docker Compose 配置
- 镜像拉取逻辑

## 注意事项

- `.env.local` 已在 `.gitignore` 中，不会被提交
- 不要在代码中硬编码私有信息
- 团队成员需要各自创建自己的 `.env.local`
- 生产环境不应依赖这些配置，应使用公共资源

## 开源友好

这种配置方式确保：
- 代码可以安全开源
- 本地开发可以使用私有资源
- 其他贡献者可以直接使用公共资源
- 不会泄露敏感信息
