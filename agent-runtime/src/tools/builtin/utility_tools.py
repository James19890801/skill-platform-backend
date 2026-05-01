"""
实用工具 - UUID、密码生成、Base转换、颜色工具、文本统计、Diff
"""

import uuid
import random
import string
import re
import difflib
from typing import Any, Dict, List, Optional
from . import ToolDef


def _uuid_gen(version: int = 4, count: int = 1) -> str:
    """生成 UUID"""
    try:
        results = []
        for _ in range(count):
            if version == 4:
                results.append(str(uuid.uuid4()))
            elif version == 1:
                results.append(str(uuid.uuid1()))
            elif version == 7:
                # uuid7 不在标准库中，fallback to uuid4
                results.append(str(uuid.uuid4()))
            else:
                return f"不支持的 UUID 版本: {version}"
        return "\n".join(results)
    except Exception as e:
        return f"UUID 生成失败: {e}"


def _password_gen(length: int = 16, use_digits: bool = True, use_symbols: bool = True,
                  use_uppercase: bool = True, count: int = 1) -> str:
    """生成随机密码"""
    chars = string.ascii_lowercase
    if use_uppercase:
        chars += string.ascii_uppercase
    if use_digits:
        chars += string.digits
    if use_symbols:
        chars += "!@#$%^&*()-_=+[]{}|;:,.<>?"
    try:
        passwords = []
        for _ in range(min(count, 10)):
            pwd = ''.join(random.SystemRandom().choice(chars) for _ in range(length))
            passwords.append(pwd)
        return "\n".join(passwords)
    except Exception as e:
        return f"密码生成失败: {e}"


def _base_convert(value: str, from_base: int, to_base: int) -> str:
    """进制转换"""
    try:
        # 支持的进制: 2, 8, 10, 16
        base_map = {2: "二进制", 8: "八进制", 10: "十进制", 16: "十六进制"}
        if from_base not in base_map or to_base not in base_map:
            return f"支持 2/8/10/16 进制"

        decimal = int(str(value), from_base)
        if to_base == 2:
            result = bin(decimal)[2:]
        elif to_base == 8:
            result = oct(decimal)[2:]
        elif to_base == 10:
            result = str(decimal)
        elif to_base == 16:
            result = hex(decimal)[2:].upper()
        else:
            result = str(decimal)

        return (f"{value} ({base_map[from_base]}) = {result} ({base_map[to_base]})")
    except Exception as e:
        return f"进制转换失败: {e}"


def _color_tool(color: str, action: str = "info") -> str:
    """颜色工具 - 颜色码转换和信息"""
    def hex_to_rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    def rgb_to_hex(r, g, b):
        return f"#{r:02x}{g:02x}{b:02x}"

    try:
        color = color.strip().lower()
        if action == "info":
            if color.startswith('#'):
                r, g, b = hex_to_rgb(color)
                hsl = f"待计算"
                return (f"颜色: {color}\n"
                        f"RGB: ({r}, {g}, {b})\n"
                        f"HEX: {color}")
            elif color.startswith('rgb'):
                nums = [int(x) for x in re.findall(r'\d+', color)]
                if len(nums) >= 3:
                    r, g, b = nums[:3]
                    hex_val = rgb_to_hex(r, g, b)
                    return (f"RGB: ({r}, {g}, {b})\n"
                            f"HEX: {hex_val}\n"
                            f"Name: {color}")
            return f"不支持的格式: {color}"
        elif action == "random":
            r, g, b = random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)
            hex_val = rgb_to_hex(r, g, b)
            return f"随机颜色: HEX={hex_val}, RGB=({r},{g},{b})"
        return f"未知操作: {action}"
    except Exception as e:
        return f"颜色处理失败: {e}"


def _text_stats(text: str) -> str:
    """文本统计分析"""
    try:
        lines = text.split('\n')
        words = text.split()
        chars = len(text)
        chars_no_space = len(text.replace(' ', '').replace('\n', ''))
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        numbers = len(re.findall(r'\d+', text))
        emails = len(re.findall(r'[\w.-]+@[\w.-]+\.\w+', text))
        urls = len(re.findall(r'https?://[^\s]+', text))

        return (f"📊 文本统计\n"
                f"字符数: {chars}（不含空格: {chars_no_space}）\n"
                f"单词/词数: {len(words)}\n"
                f"行数: {len(lines)}\n"
                f"中文字符: {chinese_chars}\n"
                f"数字: {numbers}\n"
                f"邮箱: {emails}\n"
                f"URL: {urls}\n"
                f"最长行: {max(len(l) for l in lines)} 字符")
    except Exception as e:
        return f"统计失败: {e}"


def _diff_tool(text1: str, text2: str, context_lines: int = 3) -> str:
    """文本差异比较"""
    try:
        lines1 = text1.splitlines()
        lines2 = text2.splitlines()
        diff = difflib.unified_diff(lines1, lines2, lineterm='',
                                    fromfile='原文', tofile='修改后',
                                    n=context_lines)
        result = '\n'.join(diff)
        if not result:
            return "两个文本完全相同"
        return result[:5000] + ("\n\n...(差异过长已截断)" if len(result) > 5000 else "")
    except Exception as e:
        return f"Diff 失败: {e}"


def _regex_tool(pattern: str, text: str, action: str = "find") -> str:
    """正则表达式工具"""
    try:
        if action == "find":
            matches = re.findall(pattern, text)
            if not matches:
                return f"未找到匹配: /{pattern}/"
            return f"找到 {len(matches)} 个匹配:\n" + "\n".join(str(m) for m in matches[:50])
        elif action == "replace":
            replacement = ""  # will be passed as extra param
            return "请在 action 中使用 replace_with 参数"
        elif action == "test":
            try:
                re.compile(pattern)
                return f"正则表达式有效: /{pattern}/"
            except re.error as e:
                return f"正则表达式无效: {e}"
        return f"未知操作: {action}"
    except Exception as e:
        return f"正则执行失败: {e}"


TOOLS = [
    ToolDef(name="uuid_gen", description="生成 UUID（v1/v4），支持批量生成", category="实用工具",
        parameters={"type": "object", "properties": {
            "version": {"type": "integer", "description": "UUID 版本（1 或 4）", "default": 4},
            "count": {"type": "integer", "description": "生成数量", "default": 1},
        }, "required": []},
        handler=_uuid_gen),
    ToolDef(name="password_gen", description="生成随机安全密码，可自定义长度和字符类型", category="实用工具",
        parameters={"type": "object", "properties": {
            "length": {"type": "integer", "description": "密码长度", "default": 16},
            "use_digits": {"type": "boolean", "description": "包含数字", "default": True},
            "use_symbols": {"type": "boolean", "description": "包含符号", "default": True},
            "use_uppercase": {"type": "boolean", "description": "包含大写字母", "default": True},
            "count": {"type": "integer", "description": "生成数量", "default": 1},
        }, "required": []},
        handler=_password_gen),
    ToolDef(name="base_convert", description="进制转换（2/8/10/16 进制互转）", category="实用工具",
        parameters={"type": "object", "properties": {
            "value": {"type": "string", "description": "要转换的值"},
            "from_base": {"type": "integer", "description": "原进制（2/8/10/16）"},
            "to_base": {"type": "integer", "description": "目标进制（2/8/10/16）"},
        }, "required": ["value", "from_base", "to_base"]},
        handler=_base_convert),
    ToolDef(name="color_tool", description="颜色工具：颜色码转换（HEX↔RGB）、随机颜色生成", category="实用工具",
        parameters={"type": "object", "properties": {
            "color": {"type": "string", "description": "颜色值（如 #ff0000 或 rgb(255,0,0)）"},
            "action": {"type": "string", "description": "操作: info/random", "default": "info"},
        }, "required": []},
        handler=_color_tool),
    ToolDef(name="text_stats", description="统计分析文本的字符数、词数、行数、中文字符等", category="实用工具",
        parameters={"type": "object", "properties": {
            "text": {"type": "string", "description": "要统计的文本"},
        }, "required": ["text"]},
        handler=_text_stats),
    ToolDef(name="diff_tool", description="比较两个文本的差异（Unified Diff 格式）", category="实用工具",
        parameters={"type": "object", "properties": {
            "text1": {"type": "string", "description": "原始文本"},
            "text2": {"type": "string", "description": "修改后文本"},
            "context_lines": {"type": "integer", "description": "上下文行数", "default": 3},
        }, "required": ["text1", "text2"]},
        handler=_diff_tool),
    ToolDef(name="regex_tool", description="正则表达式匹配和测试", category="实用工具",
        parameters={"type": "object", "properties": {
            "pattern": {"type": "string", "description": "正则表达式"},
            "text": {"type": "string", "description": "要匹配的文本"},
            "action": {"type": "string", "description": "操作: find/test", "default": "find"},
        }, "required": ["pattern", "text"]},
        handler=_regex_tool),
]
