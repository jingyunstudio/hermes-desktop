# Hermes Desktop 用户指南

## 安装指南

### 方案选择

根据你的网络环境选择合适的安装方案：

| 方案 | 适用场景 | 安装包大小 | 网络要求 | 安装速度 |
|------|---------|-----------|---------|---------|
| 离线安装包 | 网络不稳定/完全离线 | ~2-3GB | 无需网络 | 快 ⚡⚡⚡ |
| 在线安装包 | 网络环境较好 | ~100MB | 需要网络 | 中等 ⚡⚡ |

**推荐**：国内用户优先选择离线安装包，避免镜像拉取失败。

### 安装步骤

#### 1. 安装 Docker Desktop

Hermes Desktop 依赖 Docker 运行容器，需要先安装 Docker Desktop。

**下载地址**：
- 官方：https://www.docker.com/products/docker-desktop/
- 国内镜像：https://mirrors.aliyun.com/docker-toolbox/windows/docker-desktop/

**安装要求**：
- Windows 10/11 64位
- 启用 WSL2（安装程序会自动配置）
- 至少 4GB 内存

**安装后**：
1. 启动 Docker Desktop
2. 等待 Docker 引擎启动完成（托盘图标变为绿色）
3. 确认 Docker 正常运行：打开命令行执行 `docker --version`

#### 2. 安装 Hermes Desktop

**离线安装包**：
1. 下载 `Hermes-Desktop-Offline-Setup-{version}.exe`
2. 双击运行安装程序
3. 安装程序会自动：
   - 解压文件到 `%LOCALAPPDATA%\Programs\hermes-desktop\`
   - 创建桌面快捷方式
   - 创建开始菜单项
   - 安装完成后自动启动应用

**在线安装包**：
1. 下载 `Hermes-Desktop-Setup-{version}.exe`
2. 双击运行安装程序
3. 安装流程同上

#### 3. 首次启动

应用启动后会自动开始部署流程：

```
[1/5] 环境检测
  ├─ 检查操作系统
  └─ 检查 Docker 环境

[2/5] 安装必备环境
  ├─ 检查 Docker 是否安装
  └─ 检查 Docker 服务是否就绪

[3/5] 安装 Hermes Agent
  ├─ 拉取/导入镜像
  ├─ 创建容器
  └─ 启动服务（端口 8642）

[4/5] 安装 Open WebUI
  ├─ 拉取/导入镜像
  ├─ 创建容器
  └─ 启动服务（端口 3004）

[5/5] 健康检查
  ├─ 验证 Hermes API
  └─ 验证 Open WebUI
```

**预计时间**：
- 离线安装：2-5 分钟
- 在线安装：5-15 分钟（取决于网络速度）

#### 4. 开始使用

部署完成后，点击"打开 Open WebUI"按钮，浏览器会自动打开 http://127.0.0.1:3004

首次使用需要注册账号（本地账号，数据存储在本地）。

## 使用指南

### 界面说明

应用界面分为三个部分：

1. **固定配置**
   - Jingyun API：http://localhost:8888（预留）
   - Hermes API：http://127.0.0.1:8642
   - Open WebUI：http://127.0.0.1:3004

2. **安装阶段**
   - 显示 5 个部署阶段的实时状态
   - 每个阶段显示：状态、信息、错误码（如果失败）

3. **操作按钮**
   - **开始安装**：首次部署或重新部署
   - **重试当前步骤**：失败时重试当前阶段
   - **一键修复**：重置所有状态，从头开始
   - **打开 Open WebUI**：部署完成后打开 Web 界面

### 常见操作

#### 重启服务

如果服务异常，可以通过以下方式重启：

**方式 1：通过 Hermes Desktop**
1. 关闭 Hermes Desktop
2. 重新打开应用
3. 应用会自动检测并启动已有容器

**方式 2：通过 Docker Desktop**
1. 打开 Docker Desktop
2. 进入 Containers 标签
3. 找到 `hermes-runtime` 和 `hermes-open-webui`
4. 点击重启按钮

**方式 3：通过命令行**
```bash
docker restart hermes-runtime
docker restart hermes-open-webui
```

#### 查看日志

**通过 Docker Desktop**：
1. 打开 Docker Desktop
2. 进入 Containers 标签
3. 点击容器名称查看日志

**通过命令行**：
```bash
# 查看 Hermes 日志
docker logs hermes-runtime

# 查看 Open WebUI 日志
docker logs hermes-open-webui

# 实时查看日志
docker logs -f hermes-runtime
```

#### 停止服务

**通过 Docker Desktop**：
1. 打开 Docker Desktop
2. 进入 Containers 标签
3. 点击停止按钮

**通过命令行**：
```bash
docker stop hermes-runtime
docker stop hermes-open-webui
```

#### 完全卸载

1. 卸载 Hermes Desktop（通过 Windows 设置）
2. 删除 Docker 容器和数据卷：

```bash
# 停止并删除容器
docker stop hermes-runtime hermes-open-webui
docker rm hermes-runtime hermes-open-webui

# 删除数据卷（会删除所有数据）
docker volume rm hermes_runtime_data hermes_open_webui_data

# 删除镜像（可选）
docker rmi ghcr.io/nousresearch/hermes-agent:latest
docker rmi ghcr.io/open-webui/open-webui:main
```

## 故障排查

### 问题 1：Docker Desktop 未启动

**症状**：
- 阶段 2 失败
- 错误信息：`Docker 已安装但服务未就绪，请先启动 Docker Desktop`

**解决方案**：
1. 打开 Docker Desktop
2. 等待 Docker 引擎启动完成（托盘图标变为绿色）
3. 在 Hermes Desktop 中点击"重试当前步骤"

### 问题 2：镜像拉取失败

**症状**：
- 阶段 3 或 4 失败
- 错误信息：`镜像拉取失败。已尝试 X 个源...`

**解决方案**：

**方案 1：使用离线安装包**（推荐）
1. 下载离线版安装包
2. 重新安装

**方案 2：配置 Docker 镜像加速器**
1. 打开 Docker Desktop → Settings → Docker Engine
2. 添加镜像加速配置（见 README）
3. 重启 Docker Desktop
4. 在 Hermes Desktop 中点击"一键修复"

**方案 3：手动预拉取镜像**
```bash
# 使用国内镜像源
docker pull registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest
docker tag registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest ghcr.io/nousresearch/hermes-agent:latest

docker pull registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main
docker tag registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main ghcr.io/open-webui/open-webui:main
```

然后在 Hermes Desktop 中点击"重试当前步骤"。

### 问题 3：端口被占用

**症状**：
- 容器启动失败
- 错误信息：`bind: address already in use`

**解决方案**：

**检查端口占用**：
```bash
# 检查 8642 端口
netstat -ano | findstr :8642

# 检查 3004 端口
netstat -ano | findstr :3004
```

**释放端口**：
1. 找到占用端口的进程 PID
2. 在任务管理器中结束该进程
3. 或者修改 Hermes Desktop 配置使用其他端口（功能开发中）

### 问题 4：健康检查失败

**症状**：
- 阶段 5 失败
- 错误信息：`Hermes 健康检查未通过` 或 `Open WebUI 健康检查未通过`

**解决方案**：

1. **检查容器状态**：
```bash
docker ps -a
```

确认容器状态为 `Up`。

2. **查看容器日志**：
```bash
docker logs hermes-runtime
docker logs hermes-open-webui
```

查找错误信息。

3. **手动测试服务**：
```bash
# 测试 Hermes API
curl http://127.0.0.1:8642/health

# 测试 Open WebUI
curl http://127.0.0.1:3004
```

4. **重启容器**：
```bash
docker restart hermes-runtime
docker restart hermes-open-webui
```

5. 在 Hermes Desktop 中点击"重试当前步骤"

### 问题 5：WSL2 相关错误

**症状**：
- Docker Desktop 启动失败
- 错误信息：`WSL 2 installation is incomplete`

**解决方案**：

1. 启用 WSL2：
```powershell
# 以管理员身份运行 PowerShell
wsl --install
```

2. 重启电脑

3. 安装 Linux 内核更新包：
   - 下载：https://aka.ms/wsl2kernel
   - 安装后重启 Docker Desktop

### 问题 6：应用无法启动

**症状**：
- 双击快捷方式无反应
- 或者应用闪退

**解决方案**：

1. **查看应用日志**：
   - 位置：`%APPDATA%\hermes-desktop\logs\`

2. **重置应用状态**：
```bash
# 删除状态文件
del "%APPDATA%\hermes-desktop\bootstrap-state.json"
```

3. **重新安装**：
   - 卸载 Hermes Desktop
   - 删除 `%LOCALAPPDATA%\Programs\hermes-desktop\`
   - 重新安装

## 高级配置

### 修改端口（开发中）

当前版本端口是固定的，未来版本会支持自定义端口。

临时方案：手动修改容器端口映射

```bash
# 停止并删除容器
docker stop hermes-runtime
docker rm hermes-runtime

# 使用自定义端口重新创建
docker run -d --name hermes-runtime \
  --restart unless-stopped \
  -p 9000:8642 \
  -v hermes_runtime_data:/opt/data \
  -e API_SERVER_ENABLED=true \
  -e API_SERVER_HOST=0.0.0.0 \
  -e API_SERVER_PORT=8642 \
  -e API_SERVER_KEY=hermes-local-key \
  ghcr.io/nousresearch/hermes-agent:latest gateway run
```

### 数据备份

**备份数据卷**：
```bash
# 备份 Hermes 数据
docker run --rm -v hermes_runtime_data:/data -v %cd%:/backup alpine tar czf /backup/hermes-backup.tar.gz -C /data .

# 备份 Open WebUI 数据
docker run --rm -v hermes_open_webui_data:/data -v %cd%:/backup alpine tar czf /backup/openwebui-backup.tar.gz -C /data .
```

**恢复数据卷**：
```bash
# 恢复 Hermes 数据
docker run --rm -v hermes_runtime_data:/data -v %cd%:/backup alpine tar xzf /backup/hermes-backup.tar.gz -C /data

# 恢复 Open WebUI 数据
docker run --rm -v hermes_open_webui_data:/data -v %cd%:/backup alpine tar xzf /backup/openwebui-backup.tar.gz -C /data
```

## 性能优化

### 资源限制

默认情况下容器没有资源限制，可以根据需要设置：

```bash
# 限制 Hermes 容器资源
docker update --memory="2g" --cpus="2" hermes-runtime

# 限制 Open WebUI 容器资源
docker update --memory="1g" --cpus="1" hermes-open-webui
```

### Docker Desktop 设置

1. 打开 Docker Desktop → Settings → Resources
2. 调整以下参数：
   - **CPUs**：建议至少 4 核
   - **Memory**：建议至少 8GB
   - **Disk image size**：建议至少 64GB

## 获取帮助

如果以上方法无法解决问题，请：

1. 查看 [常见问题](https://github.com/your-org/hermes-desktop/wiki/FAQ)
2. 搜索 [已有 Issue](https://github.com/your-org/hermes-desktop/issues)
3. 提交新的 [Issue](https://github.com/your-org/hermes-desktop/issues/new)，包含：
   - 操作系统版本
   - Docker Desktop 版本
   - Hermes Desktop 版本
   - 错误信息和日志
   - 复现步骤
