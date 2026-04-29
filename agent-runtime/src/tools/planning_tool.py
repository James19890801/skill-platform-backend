"""
Planning 工具 - 任务分解与追踪
实现 Deep Agent 的核心 Planning 能力
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import json


@dataclass
class TaskItem:
    """任务项"""
    id: str
    title: str
    description: str
    status: str  # pending, in_progress, completed, failed
    priority: str  # high, medium, low
    dependencies: List[str]  # 依赖的任务 ID
    created_at: str
    updated_at: str
    result: Optional[str] = None


class PlanningTool:
    """
    任务规划工具
    
    核心能力：
    1. 任务分解 - 将复杂任务拆分为可执行的子任务
    2. 进度追踪 - 实时更新任务状态
    3. 依赖管理 - 处理任务之间的依赖关系
    4. 结果汇总 - 收集并汇总各任务执行结果
    """
    
    def __init__(self):
        self.tasks: Dict[str, TaskItem] = {}
        self.task_counter = 0
    
    def create_task_id(self) -> str:
        """生成任务 ID"""
        self.task_counter += 1
        return f"task-{self.task_counter}"
    
    def write_todos(
        self,
        tasks: List[Dict[str, Any]],
        thread_id: str = "default",
    ) -> Dict[str, Any]:
        """
        创建任务列表（类似 Deep Agent 的 write_todos 工具）
        
        Args:
            tasks: 任务列表，每个任务包含 title, description, priority
            thread_id: 会话线程 ID
            
        Returns:
            创建的任务列表信息
        """
        created_tasks = []
        
        for task_data in tasks:
            task_id = self.create_task_id()
            now = datetime.now().isoformat()
            
            task = TaskItem(
                id=task_id,
                title=task_data.get("title", "未命名任务"),
                description=task_data.get("description", ""),
                status="pending",
                priority=task_data.get("priority", "medium"),
                dependencies=task_data.get("dependencies", []),
                created_at=now,
                updated_at=now,
            )
            
            self.tasks[task_id] = task
            created_tasks.append(asdict(task))
        
        return {
            "success": True,
            "message": f"已创建 {len(created_tasks)} 个任务",
            "tasks": created_tasks,
            "thread_id": thread_id,
        }
    
    def update_task(
        self,
        task_id: str,
        status: str,
        result: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        更新任务状态
        
        Args:
            task_id: 任务 ID
            status: 新状态 (pending, in_progress, completed, failed)
            result: 任务执行结果
            
        Returns:
            更新后的任务信息
        """
        if task_id not in self.tasks:
            return {
                "success": False,
                "error": f"任务不存在: {task_id}",
            }
        
        task = self.tasks[task_id]
        task.status = status
        task.updated_at = datetime.now().isoformat()
        
        if result:
            task.result = result
        
        return {
            "success": True,
            "task": asdict(task),
        }
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务详情"""
        if task_id in self.tasks:
            return asdict(self.tasks[task_id])
        return None
    
    def list_tasks(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        列出任务
        
        Args:
            status: 状态过滤
            priority: 优先级过滤
            
        Returns:
            任务列表
        """
        tasks = [asdict(t) for t in self.tasks.values()]
        
        if status:
            tasks = [t for t in tasks if t["status"] == status]
        
        if priority:
            tasks = [t for t in tasks if t["priority"] == priority]
        
        # 按创建时间排序
        tasks.sort(key=lambda x: x["created_at"])
        
        return tasks
    
    def get_progress(self) -> Dict[str, Any]:
        """
        获取整体进度
        
        Returns:
            进度统计信息
        """
        total = len(self.tasks)
        if total == 0:
            return {
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "pending": 0,
                "failed": 0,
                "progress_percent": 0,
            }
        
        completed = sum(1 for t in self.tasks.values() if t.status == "completed")
        in_progress = sum(1 for t in self.tasks.values() if t.status == "in_progress")
        pending = sum(1 for t in self.tasks.values() if t.status == "pending")
        failed = sum(1 for t in self.tasks.values() if t.status == "failed")
        
        progress_percent = (completed / total) * 100
        
        return {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "failed": failed,
            "progress_percent": round(progress_percent, 2),
        }
    
    def clear_tasks(self) -> None:
        """清空所有任务"""
        self.tasks.clear()
        self.task_counter = 0
    
    def to_json(self) -> str:
        """导出为 JSON"""
        return json.dumps({
            "tasks": [asdict(t) for t in self.tasks.values()],
            "progress": self.get_progress(),
        }, ensure_ascii=False)


# 全局 Planning 工具实例
_planning_tool = None


def get_planning_tool() -> PlanningTool:
    """获取 Planning 工具实例"""
    global _planning_tool
    if _planning_tool is None:
        _planning_tool = PlanningTool()
    return _planning_tool