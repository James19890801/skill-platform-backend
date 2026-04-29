"""
Deep Agent Runtime - 配置管理
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


# 获取 .env 文件的绝对路径（在 agent-runtime 目录下，而不是 src 目录）
_ENV_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
    ".env"
)


class Settings(BaseSettings):
    """应用配置"""
    
    # 百炼 API
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    default_model: str = "qwen-plus"
    
    # Agent Runtime
    agent_runtime_port: int = 8001
    agent_runtime_host: str = "0.0.0.0"
    
    # Redis
    redis_url: Optional[str] = None
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./agent_runtime.db"
    
    # LangSmith
    langsmith_tracing: bool = False
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "flow-agent-platform"
    
    class Config:
        env_file = _ENV_FILE_PATH
        env_file_encoding = "utf-8"


# 全局配置实例
settings = Settings()