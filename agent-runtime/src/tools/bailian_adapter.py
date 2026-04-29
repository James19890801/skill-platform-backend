"""
Deep Agent Runtime - 百炼模型适配器
通过 OpenAI 兼容协议调用百炼 API
"""
from config.settings import settings

# 可选导入 langchain_openai
try:
    from langchain_openai import ChatOpenAI
    HAS_LANGCHAIN_OPENAI = True
except ImportError:
    HAS_LANGCHAIN_OPENAI = False
    ChatOpenAI = None


def get_bailian_llm(model: str = None, temperature: float = 0.7):
    """
    获取百炼模型实例
    
    Args:
        model: 模型名称，默认使用配置中的 default_model
        temperature: 温度参数
        
    Returns:
        ChatOpenAI 实例（如已安装）或 None
    """
    if not HAS_LANGCHAIN_OPENAI:
        return None
    
    model_name = model or settings.default_model
    
    return ChatOpenAI(
        model=model_name,
        temperature=temperature,
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
    )


# 支持的百炼模型列表
BAILIAN_MODELS = {
    "qwen-turbo": "通义千问 Turbo - 快速响应",
    "qwen-plus": "通义千问 Plus - 平衡性能",
    "qwen-max": "通义千问 Max - 最强能力",
    "qwen-long": "通义千问 Long - 长文本处理",
    "qwen-vl-plus": "通义千问 VL Plus - 视觉理解",
    "deepseek-v3": "DeepSeek V3 - 第三方模型",
    "glm-4": "GLM-4 - 智谱模型",
}


def list_available_models() -> dict:
    """返回可用模型列表"""
    return BAILIAN_MODELS