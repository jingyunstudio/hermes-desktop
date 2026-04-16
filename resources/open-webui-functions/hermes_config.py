"""
title: Hermes 配置
author: Hermes Desktop
version: 0.1.0
"""

from pydantic import BaseModel, Field
from typing import Optional


class Action:
    class Valves(BaseModel):
        config_url: str = Field(
            default="http://localhost:3005",
            description="Hermes 配置服务 URL"
        )

    def __init__(self):
        self.valves = self.Valves()

    async def action(
        self,
        body: dict,
        __user__=None,
        __event_emitter__=None,
        __event_call__=None,
    ) -> Optional[dict]:
        """
        在聊天界面添加"配置 Hermes"按钮
        """
        await __event_emitter__(
            {
                "type": "status",
                "data": {
                    "description": "打开 Hermes 配置页面",
                    "done": False
                }
            }
        )

        # 返回一个包含链接的消息
        message = f"""
### ⚙️ Hermes Agent 配置

点击下方链接打开配置页面：

[🔗 打开 Hermes 配置]({self.valves.config_url})

在配置页面中，你可以：
- 选择 LLM Provider（OpenRouter、Anthropic、OpenAI、Gemini）
- 配置 API Key
- 测试连接
- 选择模型

配置完成后，Hermes Agent 将使用你选择的模型进行对话。
"""

        await __event_emitter__(
            {
                "type": "status",
                "data": {
                    "description": "配置页面链接已生成",
                    "done": True
                }
            }
        )

        return message
