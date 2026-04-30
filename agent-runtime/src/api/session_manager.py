"""
会话管理模块
管理用户与 Agent 的对话会话
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import uuid
import os


# 会话持久化文件路径
SESSION_STORAGE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "sessions"
)


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
    4. 会话持久化（自动保存到文件）
    """
    
    def __init__(self, persist_dir: str = None):
        self.sessions: Dict[str, Session] = {}
        self.persist_dir = persist_dir or SESSION_STORAGE_DIR
        # 启动时自动加载已持久化的会话
        self._load_all()
    
    # ----- 持久化 -----
    
    def _session_file_path(self, session_id: str) -> str:
        """获取会话持久化文件路径"""
        os.makedirs(self.persist_dir, exist_ok=True)
        return os.path.join(self.persist_dir, f"{session_id}.json")
    
    def _save_session(self, session: Session):
        """保存单个会话到文件"""
        try:
            file_path = self._session_file_path(session.session_id)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump({
                    "session_id": session.session_id,
                    "thread_id": session.thread_id,
                    "user_id": session.user_id,
                    "model": session.model,
                    "skills": session.skills,
                    "messages": session.messages,
                    "created_at": session.created_at,
                    "updated_at": session.updated_at,
                    "metadata": session.metadata,
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[SessionManager] 保存会话失败 {session.session_id}: {e}")
    
    def _load_all(self):
        """从文件加载所有已持久化的会话"""
        if not os.path.isdir(self.persist_dir):
            return
        for filename in os.listdir(self.persist_dir):
            if not filename.endswith(".json"):
                continue
            file_path = os.path.join(self.persist_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                session = Session(
                    session_id=data["session_id"],
                    thread_id=data["thread_id"],
                    user_id=data.get("user_id"),
                    model=data.get("model", "qwen-plus"),
                    skills=data.get("skills", []),
                    messages=data.get("messages", []),
                    created_at=data.get("created_at", ""),
                    updated_at=data.get("updated_at", ""),
                    metadata=data.get("metadata", {}),
                )
                self.sessions[session.session_id] = session
            except Exception as e:
                print(f"[SessionManager] 加载会话失败 {filename}: {e}")
    
    def _delete_session_file(self, session_id: str):
        """删除会话持久化文件"""
        file_path = self._session_file_path(session_id)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"[SessionManager] 删除会话文件失败 {session_id}: {e}")
    
    # ----- 会话 CRUD -----
    
    def create_session(
        self,
        user_id: Optional[str] = None,
        model: str = "qwen-plus",
        skills: List[str] = None,
        metadata: Dict[str, Any] = None,
        thread_id: Optional[str] = None,
    ) -> Session:
        """
        创建新会话
        
        Args:
            user_id: 用户 ID
            model: 使用的模型
            skills: 加载的 Skills
            metadata: 元数据
            thread_id: 指定线程 ID（可选）
            
        Returns:
            新创建的会话
        """
        now = datetime.now().isoformat()
        session_id = str(uuid.uuid4())
        if not thread_id:
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
        self._save_session(session)
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
    
    def ensure_session_for_thread(
        self,
        thread_id: str,
        user_id: Optional[str] = None,
        model: str = "qwen-plus",
    ) -> Session:
        """
        确保指定 thread_id 存在会话。如果不存在则创建。
        
        Args:
            thread_id: 线程 ID
            user_id: 用户 ID（创建时使用）
            model: 模型名称
            
        Returns:
            已存在或新创建的会话
        """
        existing = self.get_session_by_thread(thread_id)
        if existing:
            return existing
        
        # 创建新会话，使用指定的 thread_id
        return self.create_session(
            user_id=user_id,
            model=model,
            thread_id=thread_id,
        )
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        向会话添加消息（自动持久化）
        
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
        
        # 自动持久化
        self._save_session(session)
        
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
        self._save_session(session)
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话（同时删除持久化文件）"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            self._delete_session_file(session_id)
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
        """清空所有会话（同时删除所有持久化文件）"""
        for session_id in list(self.sessions.keys()):
            self._delete_session_file(session_id)
        self.sessions.clear()


# 全局会话管理器实例
_session_manager = None


def get_session_manager() -> SessionManager:
    """获取会话管理器实例"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager