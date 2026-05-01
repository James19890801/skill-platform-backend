"""
文件操作工具 - 读写文件、目录列表、文件搜索、CSV 处理
"""

import os
import glob
import csv
import json
from typing import Any, Dict, List, Optional
from . import ToolDef

# 允许访问的基础路径（沙箱）
ALLOWED_BASE = os.path.expanduser("~/Desktop")


def _safe_path(path: str) -> Optional[str]:
    """检查路径是否安全，返回绝对路径"""
    abs_path = os.path.abspath(os.path.expanduser(path))
    # 允许 Desktop 和当前工作目录
    allowed = [ALLOWED_BASE, os.getcwd()]
    for base in allowed:
        if abs_path.startswith(base):
            return abs_path
    return None


def _file_read(path: str, encoding: str = "utf-8", max_size: int = 100000) -> str:
    """读取文件内容"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径（仅允许 Desktop 和当前目录）"
    try:
        size = os.path.getsize(safe)
        if size > max_size:
            return f"文件过大（{size} bytes），仅允许读取最多 {max_size} bytes"
        with open(safe, "r", encoding=encoding) as f:
            return f.read()
    except UnicodeDecodeError:
        return f"[二进制文件] 路径: {safe}, 大小: {os.path.getsize(safe)} bytes"
    except Exception as e:
        return f"读取失败: {e}"


def _file_write(path: str, content: str, encoding: str = "utf-8") -> str:
    """写入文件内容"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径"
    try:
        os.makedirs(os.path.dirname(safe), exist_ok=True)
        with open(safe, "w", encoding=encoding) as f:
            f.write(content)
        return f"文件已写入: {safe} ({len(content)} bytes)"
    except Exception as e:
        return f"写入失败: {e}"


def _file_list(path: str = ".", pattern: str = "*", recursive: bool = False) -> str:
    """列出目录中的文件"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径"
    try:
        if recursive:
            pattern_path = os.path.join(safe, "**", pattern)
            files = glob.glob(pattern_path, recursive=True)
        else:
            pattern_path = os.path.join(safe, pattern)
            files = glob.glob(pattern_path)
        # 计算文件大小和修改时间
        entries = []
        for f in sorted(files):
            try:
                stat = os.stat(f)
                rel = os.path.relpath(f, safe)
                if os.path.isdir(f):
                    entries.append(f"[DIR]  {rel}/")
                else:
                    size = stat.st_size
                    size_str = f"{size}B" if size < 1024 else f"{size/1024:.1f}KB" if size < 1024*1024 else f"{size/1024/1024:.1f}MB"
                    entries.append(f"[FILE] {rel} ({size_str})")
            except:
                pass
        total = len(entries)
        lines = entries[:200]
        result = f"目录: {safe}\n总数: {total} 个条目\n\n" + "\n".join(lines)
        if total > 200:
            result += f"\n...（还有 {total - 200} 个条目未显示）"
        return result
    except Exception as e:
        return f"列表失败: {e}"


def _file_search(pattern: str, path: str = ".", content_search: Optional[str] = None) -> str:
    """搜索文件"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径"
    try:
        files = glob.glob(os.path.join(safe, "**", pattern), recursive=True)
        if not files:
            return f"未找到匹配的文件: {pattern}"

        if content_search:
            matching = []
            for f in files[:100]:
                try:
                    with open(f, "r", encoding="utf-8", errors="ignore") as fh:
                        for i, line in enumerate(fh, 1):
                            if content_search.lower() in line.lower():
                                matching.append(f"{os.path.relpath(f, safe)}:{i}")
                                break
                except:
                    pass
            result = f"搜索内容 '{content_search}' 在 {len(files)} 个文件中\n"
            if matching:
                result += "\n".join(matching[:50])
                if len(matching) > 50:
                    result += f"\n...（还有 {len(matching)-50} 个匹配）"
            else:
                result += "无匹配"
            return result
        else:
            lines = [os.path.relpath(f, safe) for f in files[:200]]
            result = f"找到 {len(files)} 个文件:\n" + "\n".join(lines)
            if len(files) > 200:
                result += f"\n...（还有 {len(files)-200} 个未显示）"
            return result
    except Exception as e:
        return f"搜索失败: {e}"


def _csv_read(path: str, delimiter: str = ",", max_rows: int = 50) -> str:
    """读取 CSV 文件内容"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径"
    try:
        with open(safe, "r", encoding="utf-8") as f:
            reader = csv.reader(f, delimiter=delimiter)
            rows = []
            for i, row in enumerate(reader):
                if i >= max_rows + 1:  # +1 for header
                    break
                rows.append(row)
        if not rows:
            return "空文件"
        # 格式化输出
        header = rows[0]
        data = rows[1:]
        col_widths = []
        n_cols = len(header)
        for c in range(n_cols):
            col = [str(row[c]) if c < len(row) else "" for row in rows]
            col_widths.append(max(len(v) for v in col) if col else 0)

        lines = [" | ".join(h.ljust(col_widths[i]) for i, h in enumerate(header))]
        lines.append("-+-".join("-" * w for w in col_widths))
        for row in data:
            padded = [str(row[c]).ljust(col_widths[i]) if c < len(row) else "".ljust(col_widths[i]) for c in range(n_cols)]
            lines.append(" | ".join(padded))
        result = f"CSV 文件: {safe}\n总行数: {len(data)}（显示前 {min(len(data), max_rows)} 行）\n\n"
        result += "\n".join(lines)
        if len(data) > max_rows:
            result += f"\n...（还有 {len(data) - max_rows} 行）"
        return result
    except Exception as e:
        return f"CSV 读取失败: {e}"


def _csv_write(path: str, data: List[Dict[str, Any]]) -> str:
    """写入 CSV 文件"""
    safe = _safe_path(path)
    if not safe:
        return f"不允许访问此路径"
    if not data:
        return "数据为空"
    try:
        os.makedirs(os.path.dirname(safe), exist_ok=True)
        with open(safe, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        return f"CSV 已写入: {safe} ({len(data)} 行)"
    except Exception as e:
        return f"CSV 写入失败: {e}"


TOOLS = [
    ToolDef(name="file_read", description="读取文本文件内容", category="文件操作",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "文件路径"},
            "encoding": {"type": "string", "description": "编码", "default": "utf-8"},
        }, "required": ["path"]},
        handler=_file_read),
    ToolDef(name="file_write", description="写入内容到文件", category="文件操作",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "文件路径"},
            "content": {"type": "string", "description": "文件内容"},
            "encoding": {"type": "string", "description": "编码", "default": "utf-8"},
        }, "required": ["path", "content"]},
        handler=_file_write),
    ToolDef(name="file_list", description="列出目录中的文件", category="文件操作",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "目录路径", "default": "."},
            "pattern": {"type": "string", "description": "文件名匹配模式（如 *.py, *.txt）", "default": "*"},
            "recursive": {"type": "boolean", "description": "是否递归子目录", "default": False},
        }, "required": []},
        handler=_file_list),
    ToolDef(name="file_search", description="按文件名模式或内容搜索文件", category="文件操作",
        parameters={"type": "object", "properties": {
            "pattern": {"type": "string", "description": "文件名 glob 模式（如 *.py, **/*.md）"},
            "path": {"type": "string", "description": "搜索目录", "default": "."},
            "content_search": {"type": "string", "description": "搜索文件内容关键词（可选）"},
        }, "required": ["pattern"]},
        handler=_file_search),
    ToolDef(name="csv_read", description="读取 CSV 文件并以表格形式展示", category="文件操作",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "CSV 文件路径"},
            "delimiter": {"type": "string", "description": "分隔符", "default": ","},
            "max_rows": {"type": "integer", "description": "最大显示行数", "default": 50},
        }, "required": ["path"]},
        handler=_csv_read),
    ToolDef(name="csv_write", description="将字典列表写入 CSV 文件", category="文件操作",
        parameters={"type": "object", "properties": {
            "path": {"type": "string", "description": "CSV 文件路径"},
            "data": {"type": "array", "items": {"type": "object"}, "description": "要写入的数据（字典列表）"},
        }, "required": ["path", "data"]},
        handler=_csv_write),
]
