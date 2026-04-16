# Hermes Desktop 调试指南

## 🐛 如何查看日志

### 方法 1：开发者工具（推荐）

应用启动后会自动打开 Chrome DevTools，可以在控制台中看到详细日志。

**日志格式**：
```
[Docker] 开始拉取镜像，共 8 个候选源
[Docker] 检查本地镜像: registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
[Docker] 本地镜像不存在，开始拉取: registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
[Docker] 拉取尝试 1/2: registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
[Docker] 拉取失败 (attempt 1): ...
[Docker] 检测到网络错误，跳过当前源的剩余重试
[Docker] 检查本地镜像: ccr.ccs.tencentyun.com/nousresearch/hermes-agent:latest
...
```

### 方法 2：应用数据目录

日志文件位置：`%APPDATA%\hermes-desktop\logs\`

状态文件位置：`%APPDATA%\hermes-desktop\bootstrap-state.json`

## 📊 日志说明

### Hermes Agent 安装日志

```
[Hermes] 开始检查 Hermes 服务状态...
[Hermes] Hermes 未运行，检查容器是否存在...
[Hermes] 容器不存在，开始拉取镜像...
[Hermes] 尝试从 8 个镜像源拉取...
```

**关键步骤**：
1. 检查服务是否已运行（http://127.0.0.1:8642）
2. 检查容器是否存在（`hermes-runtime`）
3. 拉取镜像（8 个候选源，每个源最多重试 2 次）
4. 创建并启动容器
5. 等待服务就绪（最多 30 秒，每 1.5 秒检查一次）

### Docker 拉取日志

```
[Docker] 开始拉取镜像，共 8 个候选源
[Docker] 检查本地镜像: <image>
[Docker] 本地镜像不存在，开始拉取: <image>
[Docker] 拉取尝试 1/2: <image>
[Docker] 镜像拉取成功: <image>
```

**拉取策略**：
1. 先检查本地是否已有镜像
2. 按顺序尝试 8 个镜像源
3. 每个源最多重试 2 次
4. 如果检测到网络错误（timeout/connection/network），立即跳过当前源
5. 重试间隔：800ms * 尝试次数
6. 单次拉取超时：60 秒

### 镜像源列表

**Hermes Agent**（按优先级）：
1. `registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest` （阿里云）
2. `ccr.ccs.tencentyun.com/nousresearch/hermes-agent:latest` （腾讯云）
3. `docker.m.daocloud.io/nousresearch/hermes-agent:latest` （DaoCloud）
4. `docker.m.daocloud.io/ghcr.io/nousresearch/hermes-agent:latest` （DaoCloud 代理）
5. `docker.mirrors.ustc.edu.cn/nousresearch/hermes-agent:latest` （中科大）
6. `hub-mirror.c.163.com/nousresearch/hermes-agent:latest` （网易）
7. `ghcr.io/nousresearch/hermes-agent:latest` （官方）
8. `nousresearch/hermes-agent:latest` （Docker Hub）

**Open WebUI**（按优先级）：
1. `registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main` （阿里云）
2. `ccr.ccs.tencentyun.com/open-webui/open-webui:main` （腾讯云）
3. `docker.m.daocloud.io/ghcr.io/open-webui/open-webui:main` （DaoCloud）
4. `docker.m.daocloud.io/openwebui/open-webui:main` （DaoCloud）
5. `docker.mirrors.ustc.edu.cn/open-webui/open-webui:main` （中科大）
6. `hub-mirror.c.163.com/open-webui/open-webui:main` （网易）
7. `ghcr.io/open-webui/open-webui:main` （官方）
8. `openwebui/open-webui:main` （Docker Hub）

## 🔍 常见问题诊断

### 问题 1：卡在"安装 Hermes Agent"不动

**可能原因**：
1. 镜像拉取超时（60秒）
2. 所有镜像源都无法访问
3. Docker 服务异常

**诊断步骤**：

1. **查看 DevTools 控制台**，找到最后一条日志：
   ```
   [Docker] 拉取尝试 1/2: registry.cn-hangzhou.aliyuncs.com/...
   ```
   如果卡在这里超过 60 秒，说明网络超时。

2. **手动测试镜像源**：
   ```bash
   # 测试阿里云
   docker pull registry.cn-hangzhou.aliyuncs.com/library/alpine:latest
   
   # 测试腾讯云
   docker pull ccr.ccs.tencentyun.com/library/alpine:latest
   ```

3. **检查 Docker 状态**：
   ```bash
   docker info
   docker ps -a
   ```

**解决方案**：
- 配置 Docker 镜像加速器（见 README.md）
- 使用离线安装包
- 检查网络连接和防火墙

### 问题 2：镜像拉取失败

**日志示例**：
```
[Docker] 拉取失败 (attempt 1): Error response from daemon: Get "https://...": dial tcp: i/o timeout
[Docker] 检测到网络错误，跳过当前源的剩余重试
```

**原因**：网络超时或无法访问镜像源

**解决方案**：
1. 配置 Docker 镜像加速器
2. 检查网络连接
3. 尝试使用 VPN
4. 使用离线安装包

### 问题 3：容器启动失败

**日志示例**：
```
[Hermes] 容器启动失败: Error response from daemon: driver failed programming external connectivity on endpoint hermes-runtime: Bind for 0.0.0.0:8642 failed: port is already allocated
```

**原因**：端口被占用

**解决方案**：
```bash
# 检查端口占用
netstat -ano | findstr :8642

# 停止占用端口的进程
taskkill /PID <PID> /F

# 或者删除旧容器
docker rm -f hermes-runtime
```

### 问题 4：服务启动超时

**日志示例**：
```
[Hermes] 等待服务就绪... (1/20)
[Hermes] 等待服务就绪... (2/20)
...
[Hermes] 等待服务就绪... (20/20)
[Hermes] 服务启动超时
```

**原因**：容器启动了但服务未就绪

**诊断步骤**：
```bash
# 查看容器状态
docker ps -a | grep hermes-runtime

# 查看容器日志
docker logs hermes-runtime

# 手动测试服务
curl http://127.0.0.1:8642/health
```

**解决方案**：
- 查看容器日志找到具体错误
- 检查容器资源限制
- 重启容器：`docker restart hermes-runtime`

## 🛠️ 手动调试命令

### 检查 Docker 环境
```bash
# Docker 版本
docker --version

# Docker 服务状态
docker info

# 查看所有容器
docker ps -a

# 查看所有镜像
docker images
```

### 手动拉取镜像
```bash
# 使用阿里云镜像源
docker pull registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest

# 标记为官方镜像名
docker tag registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest ghcr.io/nousresearch/hermes-agent:latest
```

### 手动启动容器
```bash
# 启动 Hermes
docker run -d --name hermes-runtime \
  --restart unless-stopped \
  -p 8642:8642 \
  -v hermes_runtime_data:/opt/data \
  -e API_SERVER_ENABLED=true \
  -e API_SERVER_HOST=0.0.0.0 \
  -e API_SERVER_PORT=8642 \
  -e API_SERVER_KEY=hermes-local-key \
  ghcr.io/nousresearch/hermes-agent:latest gateway run

# 查看日志
docker logs -f hermes-runtime

# 测试服务
curl http://127.0.0.1:8642/health
```

### 清理和重试
```bash
# 停止并删除容器
docker stop hermes-runtime hermes-open-webui
docker rm hermes-runtime hermes-open-webui

# 删除镜像（可选）
docker rmi ghcr.io/nousresearch/hermes-agent:latest
docker rmi ghcr.io/open-webui/open-webui:main

# 删除数据卷（会删除所有数据）
docker volume rm hermes_runtime_data hermes_open_webui_data
```

## 📝 提交 Bug 报告

如果问题仍未解决，请提交 Issue 并包含以下信息：

1. **系统信息**：
   - Windows 版本
   - Docker Desktop 版本
   - Hermes Desktop 版本

2. **日志信息**：
   - DevTools 控制台完整日志
   - `%APPDATA%\hermes-desktop\bootstrap-state.json` 内容
   - Docker 容器日志（如果有）

3. **复现步骤**：
   - 详细描述操作步骤
   - 何时开始卡住
   - 等待了多久

4. **网络环境**：
   - 是否使用代理/VPN
   - 是否配置了 Docker 镜像加速器
   - 手动拉取镜像是否成功

## 🎯 性能优化建议

### 加速镜像拉取

1. **配置 Docker 镜像加速器**（推荐）
2. **使用离线安装包**（最快）
3. **预先拉取镜像**（适合批量部署）

### 减少等待时间

当前配置：
- 单次拉取超时：60 秒
- 每个源重试次数：2 次
- 重试间隔：800ms * 尝试次数
- 服务就绪检查：20 次 * 1.5 秒 = 30 秒

如果网络环境较好，可以考虑：
- 减少镜像源数量（只保留国内源）
- 减少重试次数（改为 1 次）
- 减少服务就绪检查次数

---

**新版本特性**：
- ✅ 详细的控制台日志
- ✅ 网络错误快速跳过
- ✅ 60 秒拉取超时
- ✅ 8 个国内镜像源
- ✅ 智能重试策略
