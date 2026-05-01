"""
代码执行工具 - Python REPL、Shell 命令执行
"""

import sys
import io
import subprocess
import textwrap
from typing import Any, Dict, List
from . import ToolDef


def _python_repl(code: str) -> str:
    """执行 Python 代码并返回结果（安全沙箱）"""
    try:
        # 限制危险的导入
        restricted_imports = ['os.system', 'subprocess', 'shutil.rmtree', 'pathlib.Path.unlink']
        for restricted in restricted_imports:
            if restricted in code:
                return f"出于安全考虑，禁止使用 {restricted}"

        # 捕获 stdout
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()

        # 创建安全的全局命名空间
        safe_globals = {
            "__builtins__": {
                "print": print,
                "len": len,
                "range": range,
                "int": int,
                "float": float,
                "str": str,
                "bool": bool,
                "list": list,
                "dict": dict,
                "tuple": tuple,
                "set": set,
                "sorted": sorted,
                "reversed": reversed,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "any": any,
                "all": all,
                "sum": sum,
                "min": min,
                "max": max,
                "abs": abs,
                "round": round,
                "pow": pow,
                "isinstance": isinstance,
                "type": type,
                "hasattr": hasattr,
                "getattr": getattr,
                "setattr": setattr,
                "open": open,
                "__import__": __import__,
                "Exception": Exception,
                "ValueError": ValueError,
                "TypeError": TypeError,
                "KeyError": KeyError,
                "IndexError": IndexError,
                "StopIteration": StopIteration,
                "ZeroDivisionError": ZeroDivisionError,
                "AttributeError": AttributeError,
                "ImportError": ImportError,
            },
            "math": __import__("math"),
            "json": __import__("json"),
            "re": __import__("re"),
            "datetime": __import__("datetime"),
            "random": __import__("random"),
            "collections": __import__("collections"),
            "itertools": __import__("itertools"),
            "functools": __import__("functools"),
            "typing": __import__("typing"),
        }

        exec(textwrap.dedent(code), safe_globals)
        output = sys.stdout.getvalue()
        error = sys.stderr.getvalue()

        sys.stdout = old_stdout
        sys.stderr = old_stderr

        result = ""
        if output:
            result += output
        if error:
            result += f"\n[STDERR]\n{error}"
        return result.strip() or "代码执行完成（无输出）"
    except Exception as e:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        return f"执行错误: {type(e).__name__}: {e}"


def _shell_exec(command: str, timeout: int = 30) -> str:
    """执行 Shell 命令（安全限制）"""
    # 安全检查
    dangerous = ["rm -rf", "mkfs", "dd if=", "> /dev/", "sudo", "chmod 777"]
    for d in dangerous:
        if d in command.lower():
            return f"出于安全考虑，禁止使用危险命令: {d}"
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            executable="/bin/zsh",
        )
        output = ""
        if result.stdout:
            output += result.stdout[:5000]
        if result.stderr:
            output += f"\n[STDERR]\n{result.stderr[:2000]}"
        if result.returncode != 0:
            output += f"\n[退出码: {result.returncode}]"
        return output.strip() or "命令执行完成（无输出）"
    except subprocess.TimeoutExpired:
        return f"命令执行超时（{timeout}秒）"
    except Exception as e:
        return f"命令执行失败: {e}"


TOOLS = [
    ToolDef(
        name="python_repl",
        description="执行 Python 代码片段，适合数据分析、计算、文本处理等任务",
        parameters={
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "要执行的 Python 代码"},
            },
            "required": ["code"],
        },
        category="代码执行",
        handler=_python_repl,
    ),
    ToolDef(
        name="shell_exec",
        description="执行 Shell 命令，适合文件操作、系统查询等（有安全限制）",
        parameters={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的 Shell 命令"},
                "timeout": {"type": "integer", "description": "超时秒数", "default": 30},
            },
            "required": ["command"],
        },
        category="代码执行",
        handler=_shell_exec,
    ),
]
