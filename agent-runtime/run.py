"""
Deep Agent Runtime - 启动入口
"""
import sys
import os

# 确保 src 目录在路径中
src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
sys.path.insert(0, src_path)

from config.settings import settings
import uvicorn

if __name__ == "__main__":
    print(f"Starting Deep Agent Runtime on {settings.agent_runtime_host}:{settings.agent_runtime_port}")
    print(f"Default model: {settings.default_model}")
    print(f"DashScope base URL: {settings.dashscope_base_url}")
    
    uvicorn.run(
        "src.main:app",
        host=settings.agent_runtime_host,
        port=settings.agent_runtime_port,
        reload=False,
    )