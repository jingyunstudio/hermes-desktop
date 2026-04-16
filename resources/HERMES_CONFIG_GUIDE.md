# 在 Open WebUI 中添加 Hermes 配置入口

## 方法 1：使用浏览器书签

1. 打开 Open WebUI (http://localhost:3004)
2. 添加书签：http://localhost:3005
3. 命名为 "⚙️ Hermes 配置"

## 方法 2：导入 Action Function

1. 打开 Open WebUI
2. 进入 Settings → Functions
3. 点击 "+" 添加新 Function
4. 复制 `resources/open-webui-functions/hermes_config.py` 的内容
5. 保存并启用

之后在聊天界面的工具栏中会出现"Hermes 配置"按钮。

## 方法 3：直接访问

配置服务地址：http://localhost:3005

可以直接在浏览器中打开此地址进行配置。

## 配置步骤

1. 选择 LLM Provider（OpenRouter、Anthropic、OpenAI、Gemini）
2. 输入 API Key
3. 点击"测试连接"
4. 选择模型
5. 保存配置
6. 重启 Hermes 容器使配置生效

## 获取 API Key

- **OpenRouter**: https://openrouter.ai/keys
- **Anthropic**: https://console.anthropic.com/settings/keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Google Gemini**: https://aistudio.google.com/app/apikey
