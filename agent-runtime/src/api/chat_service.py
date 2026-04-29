"""
Deep Agent Runtime - 聊天服务
直接调用百炼模型进行对话测试
"""
import httpx
import json
from typing import AsyncGenerator, Optional, List
from config.settings import settings


class ChatService:
    """聊天服务 - 直接调用百炼 OpenAI 兼容 API"""
    
    def __init__(self):
        self.api_key = settings.dashscope_api_key
        self.base_url = settings.dashscope_base_url
        self.default_model = settings.default_model
    
    async def chat(
        self,
        message: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[dict]] = None,
        stream: bool = True,
    ) -> AsyncGenerator[dict, None]:
        """
        发送聊天请求
        
        Args:
            message: 用户消息
            model: 模型名称
            system_prompt: 系统提示
            history: 对话历史
            stream: 是否流式输出
            
        Yields:
            流式输出的消息块
        """
        model_name = model or self.default_model
        
        # 构建消息列表
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        if history:
            messages.extend(history)
        
        messages.append({"role": "user", "content": message})
        
        # 构建请求体
        request_body = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4096,
            "stream": stream,
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        if stream:
            # 流式请求
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=request_body,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield {
                            "type": "error",
                            "content": f"API 错误: {response.status_code} - {error_text.decode()}",
                        }
                        return
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str == "[DONE]":
                                yield {"type": "done"}
                                return
                            
                            try:
                                data = json.loads(data_str)
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield {
                                            "type": "content",
                                            "content": content,
                                            "model": model_name,
                                        }
                            except json.JSONDecodeError:
                                continue
        else:
            # 非流式请求
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=request_body,
                )
                
                if response.status_code != 200:
                    yield {
                        "type": "error",
                        "content": f"API 错误: {response.status_code}",
                    }
                    return
                
                data = response.json()
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    yield {
                        "type": "content",
                        "content": content,
                        "model": model_name,
                    }
                yield {"type": "done"}
    
    def format_sse(self, data: dict) -> str:
        """格式化为 SSE 格式"""
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# 全局聊天服务实例
_chat_service = None


def get_chat_service() -> ChatService:
    """获取聊天服务实例"""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service