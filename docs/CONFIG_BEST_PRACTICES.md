# Hermes Desktop 配置最佳实践

## 架构概览

```
┌─────────────────┐
│   Open WebUI    │  ← 用户在这里配置 LLM 连接
│  (主配置源)      │
└────────┬────────┘
         │
         │ SQLite 数据库
         │ (webui.db)
         ↓
┌─────────────────┐
│  配置同步服务    │  ← 读取 Open WebUI 配置
│  (Port 3005)    │     写入 Hermes 配置
└────────┬────────┘
         │
         │ YAML + .env
         ↓
┌─────────────────┐
│  Hermes Agent   │  ← 使用同步后的配置
│  (Port 8642)    │
└─────────────────┘
```

## 配置结构

### Open WebUI 配置 (SQLite)

Open WebUI 在 `/app/backend/data/webui.db` 中存储配置：

```json
{
  "openai": {
    "enable": true,
    "api_base_urls": [
      "http://hermes-runtime:8642/v1",
      "https://api.openai.com/v1"
    ],
    "api_keys": [
      "hermes-local-key",
      "sk-xxx"
    ],
    "api_configs": {
      "0": {
        "enable": true
      },
      "1": {
        "enable": true,
        "model_ids": ["gpt-4", "gpt-3.5-turbo"],
        "connection_type": "external",
        "auth_type": "bearer"
      }
    }
  }
}
```

### Hermes Agent 配置

#### config.yaml (~/.hermes/config.yaml)

```yaml
model:
  default: "gpt-4"
  provider: "openai"
  base_url: "https://api.openai.com/v1"

terminal:
  shell: "bash"

display:
  color: true

memory:
  enabled: true

tools:
  enabled: true
```

#### .env (~/.hermes/.env)

```bash
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
OPENROUTER_API_KEY=sk-or-xxx
GOOGLE_API_KEY=xxx
```

## 配置同步流程

### 1. 用户在 Open WebUI 中配置

1. 打开 Open WebUI (http://localhost:3004)
2. 进入 **Workspace → Connections**
3. 点击 **+ Add Connection**
4. 填写配置：
   - **Name**: 自定义名称
   - **API Base URL**: 如 `https://api.openai.com/v1`
   - **API Key**: 你的 API Key
   - **Models**: 选择可用的模型

### 2. 同步到 Hermes Agent

1. 打开配置页面 (http://localhost:3005)
2. 查看 "检测到的连接" 列表
3. 点击 **"从 Open WebUI 同步"** 按钮
4. 系统自动：
   - 读取 Open WebUI 数据库
   - 选择第一个启用的连接作为主连接
   - 更新 Hermes 的 config.yaml
   - 更新 Hermes 的 .env 文件

### 3. 重启 Hermes 服务

配置更新后需要重启 Hermes 容器：

```bash
docker restart hermes-desktop-runtime
```

## Provider 映射

配置服务会自动检测 Provider 类型：

| URL 特征 | Provider | 环境变量 |
|---------|----------|---------|
| `openrouter.ai` | openrouter | OPENROUTER_API_KEY |
| `anthropic.com` | anthropic | ANTHROPIC_API_KEY |
| `openai.com` | openai | OPENAI_API_KEY |
| `generativelanguage.googleapis.com` | gemini | GOOGLE_API_KEY |
| 其他 | custom | CUSTOM_API_KEY |

## 最佳实践建议

### ✅ 推荐做法

1. **使用 Open WebUI 作为主配置源**
   - Open WebUI 有完善的 UI
   - 支持多个连接管理
   - 可以测试连接和模型

2. **定期同步配置**
   - 在 Open WebUI 中添加新连接后
   - 点击同步按钮更新 Hermes 配置
   - 重启 Hermes 服务使配置生效

3. **使用国内 API 中转服务**
   - OpenAI/Anthropic 在国内访问不稳定
   - 推荐使用 OpenRouter 或国内中转服务
   - 示例：`https://api.openrouter.ai/v1`

4. **配置多个备用连接**
   - 在 Open WebUI 中配置多个 Provider
   - 主连接失败时可以手动切换
   - 提高服务可用性

### ❌ 避免的做法

1. **不要直接编辑配置文件**
   - 容易出错
   - 格式问题导致服务启动失败
   - 使用 UI 更安全

2. **不要在两边同时配置**
   - 可能导致配置冲突
   - 统一使用 Open WebUI 管理

3. **不要忘记重启服务**
   - 配置更新后必须重启
   - 否则新配置不会生效

## 故障排查

### 同步失败

**问题**: 点击同步按钮后提示 "未找到 Open WebUI 连接配置"

**解决方案**:
1. 确认 Open WebUI 容器正在运行
2. 在 Open WebUI 中至少添加一个连接
3. 确保连接状态为 "已启用"

### 连接测试失败

**问题**: 在 Open WebUI 中添加连接后测试失败

**解决方案**:
1. 检查 API Base URL 是否正确
2. 检查 API Key 是否有效
3. 检查网络连接（国内可能需要代理）
4. 尝试使用国内中转服务

### Hermes 无法使用模型

**问题**: 同步后 Hermes 仍然无法调用模型

**解决方案**:
1. 检查是否重启了 Hermes 容器
2. 查看 Hermes 日志：`docker logs hermes-desktop-runtime`
3. 确认配置文件已正确更新
4. 检查 API Key 是否正确同步

## API 端点

配置服务提供以下 API：

- `GET /api/config` - 获取 Hermes 配置
- `POST /api/config` - 保存 Hermes 配置
- `GET /api/webui-connections` - 获取 Open WebUI 连接列表
- `POST /api/sync-from-webui` - 从 Open WebUI 同步配置

## 数据库位置

- **Open WebUI**: `/app/backend/data/webui.db` (容器内)
  - 映射到 Docker Volume: `hermes-desktop-webui-data`
  
- **Hermes Agent**: `~/.hermes/` (容器内)
  - 映射到 Docker Volume: `hermes-desktop-runtime-data`

## 参考资源

- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/)
- [Open WebUI 文档](https://docs.openwebui.com/)
- [OpenRouter API](https://openrouter.ai/docs)
