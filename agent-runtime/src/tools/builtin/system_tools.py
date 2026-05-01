"""
系统工具 - 进程管理、端口检查、磁盘信息、环境变量等
"""

import os
import shutil
import psutil
from typing import Any, Dict, List, Optional
from . import ToolDef


def _disk_usage(path: str = ".") -> str:
    """磁盘使用情况"""
    try:
        usage = shutil.disk_usage(os.path.abspath(path))
        total_gb = usage.total / (1024**3)
        used_gb = usage.used / (1024**3)
        free_gb = usage.free / (1024**3)
        percent = (usage.used / usage.total) * 100
        return (f"磁盘使用情况: {os.path.abspath(path)}\n"
                f"总计: {total_gb:.1f} GB\n"
                f"已用: {used_gb:.1f} GB ({percent:.1f}%)\n"
                f"可用: {free_gb:.1f} GB")
    except Exception as e:
        return f"磁盘查询失败: {e}"


def _process_list(filter_str: Optional[str] = None) -> str:
    """列出进程"""
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'memory_percent', 'cpu_percent', 'status']):
            try:
                info = proc.info
                if filter_str and filter_str.lower() not in (info['name'] or '').lower():
                    continue
                processes.append(f"PID: {info['pid']:>6}  {info['name'] or '':20}  "
                                 f"CPU: {info['cpu_percent'] or 0:>4.1f}%  "
                                 f"MEM: {info['memory_percent'] or 0:>4.1f}%  "
                                 f"状态: {info['status'] or 'N/A'}")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        processes.sort()
        return f"进程列表（显示 {len(processes)} 个）:\n" + "\n".join(processes[:100])
    except ImportError:
        return "需要安装 psutil: pip install psutil"
    except Exception as e:
        return f"进程查询失败: {e}"


def _port_check(port: int) -> str:
    """检查端口是否被占用"""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)
            result = s.connect_ex(('127.0.0.1', port))
            if result == 0:
                return f"端口 {port} 已被占用 ❌"
            else:
                return f"端口 {port} 可用 ✅"
    except Exception as e:
        return f"端口检查失败: {e}"


def _env_var(name: str) -> str:
    """查看环境变量"""
    try:
        value = os.environ.get(name)
        if value is None:
            return f"环境变量 '{name}' 未设置"
        # 对敏感变量截断显示
        sensitive_keywords = ['key', 'secret', 'password', 'token', 'auth']
        if any(k in name.lower() for k in sensitive_keywords):
            return f"{name}={value[:8]}..." if len(value) > 8 else f"{name}=***"
        return f"{name}={value}"
    except Exception as e:
        return f"查询失败: {e}"


def _env_list() -> str:
    """列出所有环境变量"""
    try:
        sensitive = ['key', 'secret', 'password', 'token', 'auth']
        vars_list = []
        for k, v in sorted(os.environ.items()):
            if any(s in k.lower() for s in sensitive):
                vars_list.append(f"{k}=***")
            else:
                vars_list.append(f"{k}={v[:100]}")
        return "环境变量列表:\n" + "\n".join(vars_list)
    except Exception as e:
        return f"查询失败: {e}"


TOOLS = [
    ToolDef(name="disk_usage", description="查看磁盘使用情况", category="系统",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "目录路径", "default": "."},
        }, "required": []},
        handler=_disk_usage),
    ToolDef(name="process_list", description="列出系统进程，可按名称过滤", category="系统",
        parameters={"type": "object", "properties": {
            "filter_str": {"type": "string", "description": "进程名称过滤关键词"},
        }, "required": []},
        handler=_process_list),
    ToolDef(name="port_check", description="检查端口是否被占用", category="系统",
        parameters={"type": "object", "properties": {
            "port": {"type": "integer", "description": "要检查的端口号"},
        }, "required": ["port"]},
        handler=_port_check),
    ToolDef(name="env_var", description="查看指定环境变量的值", category="系统",
        parameters={"type": "object", "properties": {
            "name": {"type": "string", "description": "环境变量名称"},
        }, "required": ["name"]},
        handler=_env_var),
    ToolDef(name="env_list", description="列出所有环境变量的名称和值", category="系统",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=_env_list),
]
