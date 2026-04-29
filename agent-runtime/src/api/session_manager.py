"""
会话管理模块
管理用户与 Agent 的对话会话
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import uuid


@dataclass
class Session:
    """会话信息"""
    session_id: str
    thread_id: str
    user_id: Optional[str]
    model: str
    skills: List[str]
    messages: List[Dict[str, Any]]
    created_at: str
    updated_at: str
    metadata: Dict[str, Any]


class SessionManager:
    """
    会话管理器
    
    功能：
    1. 创建/获取/删除会话
    2. 保存对话历史
    3. 会话状态追踪
    """
    
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
    
    def create_session(
        self,
        user_id: Optional[str] = None,
        model: str = "qwen-plus",
        skills: List[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> Session:
        """
        创建新会话
        
        Args:
            user_id: 用户 ID
            model: 使用的模型
            skills: 加载的 Skills
            metadata: 元数据
            
        Returns:
            新创建的会话
        """
        now = datetime.now().isoformat()
        session_id = str(uuid.uuid4())
        thread_id = f"thread-{session_id[:8]}"
        
        session = Session(
            session_id=session_id,
            thread_id=thread_id,
            user_id=user_id,
            model=model,
            skills=skills or [],
            messages=[],
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        )
        
        self.sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self.sessions.get(session_id)
    
    def get_session_by_thread(self, thread_id: str) -> Optional[Session]:
        """通过 thread_id 获取会话"""
        for session in self.sessions.values():
            if session.thread_id == thread_id:
                return session
        return None
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        向会话添加消息
        
        Args:
            session_id: 会话 ID
            role: 角色 (user/assistant/system)
            content: 消息内容
            metadata: 消息元数据
            
        Returns:
            添加的消息
        """
        session = self.sessions.get(session_id)
        if not session:
            return {"error": f"会话不存在: {session_id}"}
        
        message = {
            "id": f"msg-{len(session.messages) + 1}",
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }
        
        session.messages.append(message)
        session.updated_at = datetime.now().isoformat()
        
        return message
    
    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """获取会话历史"""
        session = self.sessions.get(session_id)
        if not session:
            return []
        
        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in session.messages
        ]
    
    def update_session(
        self,
        session_id: str,
        model: Optional[str] = None,
        skills: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Session]:
        """更新会话设置"""
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        if model:
            session.model = model
        if skills:
            session.skills = skills
        if metadata:
            session.metadata.update(metadata)
        
        session.updated_at = datetime.now().isoformat()
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False
    
    def list_sessions(
        self,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """列出会话"""
        sessions = [asdict(s) for s in self.sessions.values()]
        
        if user_id:
            sessions = [s for s in sessions if s["user_id"] == user_id]
        
        # 按更新时间排序（最近的在前）
        sessions.sort(key=lambda x: x["updated_at"], reverse=True)
        
        return sessions
    
    def clear_all(self) -> None:
        """清空所有会话"""
        self.sessions.clear()


# 全局会话管理器实例
_session_manager = None


def get_session_manager() -> SessionManager:
    """获取会话管理器实例"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager