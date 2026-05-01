"""
内置工具模块 - 提供 40+ 开箱即用的 Agent 工具

架构：
- 每个工具是一个 ToolDef（名称、描述、参数 schema、执行函数）
- ToolRegistry 自动发现和注册所有工具
- 支持工具列表查询和按名称调用
"""

from typing import Any, Dict, List, Optional, Callable
import inspect
import json


class ToolDef:
    """工具定义"""
    def __init__(
        self,
        name: str,
        description: str,
        handler: Callable,
        parameters: Optional[Dict[str, Any]] = None,
        category: str = "通用",
    ):
        self.name = name
        self.description = description
        self.handler = handler
        self.parameters = parameters or {
            "type": "object",
            "properties": {},
            "required": [],
        }
        self.category = category

    def execute(self, **kwargs) -> Dict[str, Any]:
        """执行工具，统一异常处理"""
        try:
            result = self.handler(**kwargs)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "category": self.category,
        }


class ToolRegistry:
    """工具注册中心 - 自动发现和管理所有内置工具"""

    def __init__(self):
        self._tools: Dict[str, ToolDef] = {}

    def register(self, tool: ToolDef):
        self._tools[tool.name] = tool

    def register_many(self, tools: List[ToolDef]):
        for t in tools:
            self._tools[t.name] = t

    def get(self, name: str) -> Optional[ToolDef]:
        return self._tools.get(name)

    def list_tools(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        tools = self._tools.values()
        if category:
            tools = [t for t in tools if t.category == category]
        return [t.to_dict() for t in sorted(tools, key=lambda x: x.name)]

    def list_categories(self) -> List[str]:
        categories = set(t.category for t in self._tools.values())
        return sorted(categories)

    def execute(self, name: str, **kwargs) -> Dict[str, Any]:
        tool = self.get(name)
        if not tool:
            return {"success": False, "error": f"工具不存在: {name}"}
        return tool.execute(**kwargs)

    @property
    def total(self) -> int:
        return len(self._tools)


# 全局注册中心
_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    """获取全局工具注册中心（单例）"""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
        _discover_and_register(_registry)
    return _registry


def _discover_and_register(registry: ToolRegistry):
    """自动发现并注册所有内置工具"""
    from . import web_search
    from . import web_scrape
    from . import code_exec
    from . import file_ops
    from . import data_tools
    from . import network_tools
    from . import utility_tools
    from . import media_tools
    from . import knowledge_tools
    from . import system_tools

    registry.register_many(web_search.TOOLS)
    registry.register_many(web_scrape.TOOLS)
    registry.register_many(code_exec.TOOLS)
    registry.register_many(file_ops.TOOLS)
    registry.register_many(data_tools.TOOLS)
    registry.register_many(network_tools.TOOLS)
    registry.register_many(utility_tools.TOOLS)
    registry.register_many(media_tools.TOOLS)
    registry.register_many(knowledge_tools.TOOLS)
    registry.register_many(system_tools.TOOLS)


def generate_tools_prompt() -> str:
    """
    生成工具注册信息，格式化为 system prompt 段落
    让 AI 知道有哪些可用工具及其调用方式
    """
    registry = get_tool_registry()
    tools = registry.list_tools()
    categories = registry.list_categories()
    
    # 分类图标映射
    icon_map = {
        "搜索": "🔍",
        "网页抓取": "🌐",
        "数据处理": "📊",
        "文件操作": "📁",
        "网络": "🌍",
        "实用工具": "⚙️",
        "媒体": "🖼️",
        "知识": "📚",
        "代码执行": "💻",
        "系统": "🖥️",
    }
    
    lines = [
        "## 可用内置工具",
        "",
        "你拥有以下内置工具，可以在需要时调用它们来获取信息或执行操作。",
        "",
        f"工具总数: {registry.total}，按 {len(categories)} 个分类组织",
        "",
        "### 调用方式",
        "当需要执行某个工具时，在回复中按以下格式输出：",
        "",
        '```tool',
        '{"name": "工具名称", "arguments": {"参数1": "值1", "参数2": "值2"}}',
        '```',
        "",
        "系统会自动解析并执行工具，将结果返回给你。",
        "",
    ]
    
    # 按分类列出工具
    for cat in categories:
        icon = icon_map.get(cat, "🔧")
        cat_tools = [t for t in tools if t["category"] == cat]
        lines.append(f"### {icon} {cat}（{len(cat_tools)}个）")
        lines.append("")
        for t in cat_tools:
            params = t.get("parameters", {}).get("properties", {})
            param_desc = ", ".join(f"{k}" for k in params.keys()) if params else "无参数"
            lines.append(f"- **{t['name']}**({param_desc}): {t['description']}")
        lines.append("")
    
    lines.append("---")
    lines.append("请根据需要选择合适的工具。如果不确定使用哪个工具，可以先说明需求，我会推荐合适的工具。")
    
    return "\n".join(lines)
