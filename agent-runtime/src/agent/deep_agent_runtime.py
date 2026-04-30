"""
Deep Agent Runtime - 核心运行时引擎
基于 Deep Agent SDK + LangGraph 构建智能体执行环境
"""
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
import asyncio
import os
import sys

# 添加 src 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 可选导入 deepagents（如未安装则使用简化实现）
try:
    from deepagents import create_deep_agent
    HAS_DEEP_AGENTS = True
except ImportError:
    HAS_DEEP_AGENTS = False
    create_deep_agent = None

# 可选导入 langchain
try:
    from langchain_core.tools import tool
    from langchain_core.messages import HumanMessage, AIMessage
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False
    tool = None
    HumanMessage = None
    AIMessage = None

from config.settings import settings
from tools.bailian_adapter import get_bailian_llm


@dataclass
class SkillDefinition:
    """Skill 定义结构（Anthropic 标准）"""
    name: str
    description: str
    instructions: str  # SKILL.md 内容
    tools: List[Callable]  # 工具函数列表
    version: str = "1.0.0"
    author: str = ""


class DeepAgentRuntime:
    """
    Deep Agent 运行时引擎
    
    核心能力：
    - Planning: 任务分解与追踪 (write_todos)
    - Context Management: 文件系统工具，防止上下文溢出
    - Subagent Spawning: task 工具派发子任务
    - Long-term Memory: 跨对话持久化记忆
    - Skills: 动态加载技能
    """
    
    def __init__(
        self,
        model: str = None,
        skills_dir: str = None,
        memory_enabled: bool = True,
    ):
        self.model = model or settings.default_model
        self.skills_dir = skills_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills"
        )
        self.memory_enabled = memory_enabled
        self._loaded_skills: Dict[str, SkillDefinition] = {}
        self._agents: Dict[str, Any] = {}  # thread_id -> agent instance
        
    def load_skill(self, skill_path: str) -> SkillDefinition:
        """
        加载 Skill（Anthropic 标准格式）
        
        Skill 目录结构：
        skills/
        ├── skill.yaml          # 元数据
        ├── SKILL.md            # 核心指令
        ├── tools/              # 工具定义
        └── templates/          # 模板文件
        """
        import yaml
        
        # 读取 skill.yaml
        yaml_path = os.path.join(skill_path, "skill.yaml")
        if os.path.exists(yaml_path):
            with open(yaml_path, "r", encoding="utf-8") as f:
                metadata = yaml.safe_load(f)
        else:
            metadata = {}
        
        # 读取 SKILL.md
        skill_md_path = os.path.join(skill_path, "SKILL.md")
        if os.path.exists(skill_md_path):
            with open(skill_md_path, "r", encoding="utf-8") as f:
                instructions = f.read()
        else:
            instructions = ""
        
        # 加载工具（如果有）
        tools = []
        tools_dir = os.path.join(skill_path, "tools")
        if os.path.exists(tools_dir):
            for tool_file in os.listdir(tools_dir):
                if tool_file.endswith(".py"):
                    # 动态加载工具模块
                    tool_module_path = os.path.join(tools_dir, tool_file)
                    # TODO: 实现动态工具加载
        
        skill = SkillDefinition(
            name=metadata.get("name", os.path.basename(skill_path)),
            description=metadata.get("description", ""),
            instructions=instructions,
            tools=tools,
            version=metadata.get("version", "1.0.0"),
            author=metadata.get("author", ""),
        )
        
        self._loaded_skills[skill.name] = skill
        return skill
    
    def create_agent(
        self,
        thread_id: str,
        system_prompt: str = None,
        skills: List[str] = None,
        custom_tools: List[Callable] = None,
    ) -> Any:
        """
        创建 Deep Agent 实例
        
        Args:
            thread_id: 会话线程 ID
            system_prompt: 自定义系统提示
            skills: 要加载的 Skill 名称列表
            custom_tools: 自定义工具函数列表
            
        Returns:
            Deep Agent 实例（LangGraph 编排图）
        """
        # 合并系统提示
        base_prompt = """你是一个智能流程自动化助手，具备以下核心能力：

1. Planning - 任务分解与追踪：将复杂任务分解为可执行的步骤
2. Context Management - 上下文管理：有效管理大量信息，防止信息丢失
3. Subagent Spawning - 子任务派发：将子任务派发给专门的子智能体
4. Memory - 持久记忆：记住用户偏好和历史交互

执行原则：
- 先规划，再执行
- 验证每个步骤的结果
- 保持上下文清晰
- 及时总结和汇报
"""
        
        # 加载 Skill 指令
        skill_instructions = []
        if skills:
            for skill_name in skills:
                if skill_name in self._loaded_skills:
                    skill = self._loaded_skills[skill_name]
                    skill_instructions.append(f"\n### Skill: {skill.name}\n{skill.instructions}")
        
        full_prompt = base_prompt + "\n".join(skill_instructions)
        if system_prompt:
            full_prompt = system_prompt + "\n" + full_prompt
        
        # 合并工具
        all_tools = custom_tools or []
        for skill_name in (skills or []):
            if skill_name in self._loaded_skills:
                all_tools.extend(self._loaded_skills[skill_name].tools)
        
        # 创建 Agent（根据是否有 deepagents）
        if HAS_DEEP_AGENTS and HAS_LANGCHAIN:
            # 使用 Deep Agent SDK
            llm = get_bailian_llm(self.model)
            
            agent = create_deep_agent(
                model=llm,
                tools=all_tools,
                system_prompt=full_prompt,
            )
        else:
            # Fallback: 简单的会话存储
            agent = {
                "thread_id": thread_id,
                "system_prompt": full_prompt,
                "model": self.model,
                "history": [],
            }
        
        self._agents[thread_id] = agent
        return agent
    
    async def run_stream(
        self,
        thread_id: str,
        user_input: str,
        history: List[Dict] = None,
    ):
        """
        流式运行 Agent
        
        Args:
            thread_id: 会话线程 ID
            user_input: 用户输入文本
            history: 对话历史列表 [{"role": "user"/"assistant", "content": "..."}]
            
        Yields:
            流式输出的消息块
        """
        if thread_id not in self._agents:
            self.create_agent(thread_id)
        
        agent = self._agents[thread_id]
        
        # 保存历史到 agent
        if history:
            agent["history"] = history
        
        if HAS_DEEP_AGENTS and HAS_LANGCHAIN and hasattr(agent, 'astream'):
            # 使用 Deep Agent SDK
            # 构建包含历史的输入
            agent_history = agent.get("history", [])
            messages = []
            for msg in agent_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=user_input))
            
            input_data = {
                "messages": messages
            }
            async for chunk in agent.astream(input_data):
                yield chunk
        else:
            # Fallback: 不支持流式，返回提示
            yield {
                "type": "content",
                "content": "Deep Agent SDK 未安装，请使用 /v2/chat 端点进行对话",
            }
    
    async def run(
        self,
        thread_id: str,
        user_input: str,
        history: List[Dict] = None,
        stream: bool = False,
    ) -> Dict:
        """
        非流式运行 Agent
        
        Args:
            thread_id: 会话线程 ID
            user_input: 用户输入文本
            history: 对话历史列表
            stream: 是否流式输出
            
        Returns:
            执行结果
        """
        if thread_id not in self._agents:
            self.create_agent(thread_id)
        
        agent = self._agents[thread_id]
        
        # 保存历史到 agent
        if history:
            agent["history"] = history
        
        if HAS_DEEP_AGENTS and HAS_LANGCHAIN and hasattr(agent, 'ainvoke'):
            # 使用 Deep Agent SDK
            agent_history = agent.get("history", [])
            messages = []
            for msg in agent_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=user_input))
            
            input_data = {
                "messages": messages
            }
            result = await agent.ainvoke(input_data)
            return result
        else:
            # Fallback: 返回提示
            return {
                "type": "error",
                "content": "Deep Agent SDK 未安装，请使用 /v2/chat 端点",
            }
    
    def get_memory(self, thread_id: str) -> List[Dict]:
        """获取会话记忆"""
        # TODO: 实现跨会话记忆存储
        pass
    
    def clear_memory(self, thread_id: str) -> None:
        """清除会话记忆"""
        if thread_id in self._agents:
            del self._agents[thread_id]


# 全局运行时实例
_runtime = None


def get_runtime() -> DeepAgentRuntime:
    """获取全局运行时实例"""
    global _runtime
    if _runtime is None:
        _runtime = DeepAgentRuntime()
    return _runtime