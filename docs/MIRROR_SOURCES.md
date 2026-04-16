# 国内 Docker 镜像源配置指南

## 当前支持的镜像源

### Hermes Agent 镜像源（按优先级）

1. **本地镜像**（最优先）
   - 如果本地已有镜像，直接使用

2. **离线镜像包**（次优先）
   - `resources/offline-images/hermes-agent-latest.tar`
   - 适合完全离线环境

3. **在线镜像源**（按顺序尝试）
   ```
   # 阿里云镜像加速
   registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
   
   # 腾讯云镜像加速
   ccr.ccs.tencentyun.com/nousresearch/hermes-agent:latest
   
   # DaoCloud 镜像加速
   docker.m.daocloud.io/nousresearch/hermes-agent:latest
   docker.m.daocloud.io/ghcr.io/nousresearch/hermes-agent:latest
   
   # 官方源（国内可能无法访问）
   ghcr.io/nousresearch/hermes-agent:latest
   nousresearch/hermes-agent:latest
   ```

### Open WebUI 镜像源（按优先级）

1. **本地镜像**
2. **离线镜像包**
3. **在线镜像源**
   ```
   # 阿里云镜像加速
   registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main
   
   # 腾讯云镜像加速
   ccr.ccs.tencentyun.com/open-webui/open-webui:main
   
   # DaoCloud 镜像加速
   docker.m.daocloud.io/ghcr.io/open-webui/open-webui:main
   docker.m.daocloud.io/openwebui/open-webui:main
   
   # 官方源
   ghcr.io/open-webui/open-webui:main
   openwebui/open-webui:main
   ```

## 推荐方案

### 方案 1：使用离线安装包（推荐）

**适用场景**：网络环境不稳定或完全离线

**步骤**：
1. 下载离线版安装包：`Hermes-Desktop-Offline-Setup-{version}.exe`
2. 安装包已内置镜像，无需网络拉取
3. 安装时自动导入离线镜像

**优点**：
- 不依赖网络
- 安装速度快
- 成功率 100%

**缺点**：
- 安装包体积大（约 2-3GB）

### 方案 2：配置 Docker 镜像加速器

**适用场景**：有网络但访问官方源较慢

**步骤**：

#### Windows (Docker Desktop)

1. 打开 Docker Desktop
2. 进入 Settings → Docker Engine
3. 添加镜像加速配置：

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

#### Linux

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://ccr.ccs.tencentyun.com",
    "https://docker.m.daocloud.io"
  ]
}
```

重启 Docker：
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方案 3：手动预拉取镜像

**适用场景**：在网络较好的环境预先准备

**步骤**：

```bash
# 拉取 Hermes Agent
docker pull registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
docker tag registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest ghcr.io/nousresearch/hermes-agent:latest

# 拉取 Open WebUI
docker pull registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main
docker tag registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main ghcr.io/open-webui/open-webui:main
```

然后运行 Hermes Desktop，会自动使用本地镜像。

## 镜像源可用性测试

可以使用以下命令测试镜像源是否可用：

```bash
# 测试阿里云
docker pull registry.cn-hangzhou.aliyuncs.com/library/alpine:latest

# 测试腾讯云
docker pull ccr.ccs.tencentyun.com/library/alpine:latest

# 测试 DaoCloud
docker pull docker.m.daocloud.io/library/alpine:latest
```

## 常见问题

### Q: 所有镜像源都拉取失败怎么办？

A: 使用离线安装包，或者：
1. 检查 Docker Desktop 是否正常运行
2. 检查网络连接
3. 尝试配置 Docker 镜像加速器
4. 联系管理员检查企业防火墙设置

### Q: 如何制作自己的离线镜像包？

A: 在有网络的环境执行：

```bash
# 拉取镜像
docker pull ghcr.io/nousresearch/hermes-agent:latest
docker pull ghcr.io/open-webui/open-webui:main

# 导出镜像
docker save -o hermes-agent-latest.tar ghcr.io/nousresearch/hermes-agent:latest
docker save -o open-webui-main.tar ghcr.io/open-webui/open-webui:main

# 将 tar 文件放到 Hermes Desktop 安装目录的 resources/offline-images/ 下
```

### Q: 镜像拉取很慢怎么办？

A: 
1. 优先使用离线安装包
2. 配置多个镜像加速器
3. 在网络较好的时段进行安装
4. 考虑使用企业内部镜像仓库

## 企业部署建议

对于企业内部部署，建议：

1. **搭建内部镜像仓库**
   - 使用 Harbor 或 Nexus 搭建私有镜像仓库
   - 定期同步官方镜像到内部仓库
   - 修改 Hermes Desktop 配置指向内部仓库

2. **统一使用离线安装包**
   - 制作包含所有依赖的离线安装包
   - 通过内部文件服务器分发
   - 避免每台机器都从外网拉取

3. **配置代理服务器**
   - 为 Docker 配置 HTTP/HTTPS 代理
   - 确保代理服务器可以访问官方镜像源
