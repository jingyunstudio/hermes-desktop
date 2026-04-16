# GitHub Actions 配置说明

## 概述

项目使用 GitHub Actions 自动构建和推送 Docker 镜像。配置文件使用 GitHub Secrets 来保护私有仓库信息。

## 配置 GitHub Secrets

在你的 GitHub 仓库中配置以下 Secrets（Settings → Secrets and variables → Actions）：

### 必需的 Secrets

1. **DOCKER_REGISTRY**
   - 你的 Docker 镜像仓库地址
   - 示例：`registry.example.com` 或 `your-registry.cn-region.cr.aliyuncs.com`
   - 留空则使用 `ghcr.io`（GitHub Container Registry）

2. **DOCKER_USERNAME**
   - 仓库登录用户名
   - 留空则使用 GitHub 用户名

3. **DOCKER_PASSWORD**
   - 仓库登录密码或 Token
   - 留空则使用 `GITHUB_TOKEN`

4. **DOCKER_IMAGE_PREFIX**
   - 镜像名称前缀
   - 示例：`my-project` 或 `company-name`
   - 留空则使用 `your-org`

## 工作流说明

### build-and-push-images.yml

自动构建和推送 Docker 镜像到配置的仓库。

**触发条件**：
- 手动触发（workflow_dispatch）
- 推送到 main 分支且修改了 packages/ 目录

**构建的镜像**：
- Hermes Agent: `{REGISTRY}/{PREFIX}/hermes-agent:latest`
- Open WebUI: `{REGISTRY}/{PREFIX}/open-webui:main`

**标签策略**：
- `latest` / `main` - 最新版本
- `{git-sha}` - 特定提交版本

## 使用示例

### 使用 GitHub Container Registry（公开）

不需要配置任何 Secrets，直接使用：
- 镜像会推送到 `ghcr.io/your-username/hermes-agent:latest`
- 需要在仓库设置中启用 GitHub Packages

### 使用阿里云 ACR（私有）

配置以下 Secrets：
```
DOCKER_REGISTRY=your-registry.cn-region.cr.aliyuncs.com
DOCKER_USERNAME=your-acr-username
DOCKER_PASSWORD=your-acr-password
DOCKER_IMAGE_PREFIX=your-namespace
```

镜像会推送到：
- `your-registry.cn-region.cr.aliyuncs.com/your-namespace/hermes-agent:latest`

## 本地测试

如果需要在本地测试构建：

```bash
# 设置环境变量
export REGISTRY=your-registry.com
export IMAGE_PREFIX=your-prefix

# 构建镜像
docker build -f packages/hermes-agent/Dockerfile -t $REGISTRY/$IMAGE_PREFIX/hermes-agent:latest .

# 推送镜像
docker push $REGISTRY/$IMAGE_PREFIX/hermes-agent:latest
```

## 注意事项

1. **私有仓库**：确保 Secrets 配置正确，否则推送会失败
2. **权限**：GitHub Actions 需要有推送镜像的权限
3. **缓存**：使用 GitHub Actions Cache 加速构建
4. **安全**：永远不要在代码中硬编码凭证，使用 Secrets

## 开源友好

这种配置方式确保：
- 工作流配置可以安全开源
- 私有信息存储在 GitHub Secrets 中
- 其他贡献者可以使用自己的仓库
- Fork 的仓库需要配置自己的 Secrets
