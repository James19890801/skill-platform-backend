"""
数据处理工具 - JSON、计算器、单位转换、日期时间、哈希工具
"""

import json
import math
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List
from . import ToolDef


def _json_tool(data: str, action: str = "parse") -> str:
    """JSON 解析、格式化和比较"""
    try:
        if action == "parse":
            parsed = json.loads(data)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        elif action == "validate":
            json.loads(data)
            return "JSON 格式有效 ✅"
        elif action == "minify":
            parsed = json.loads(data)
            return json.dumps(parsed, separators=(',', ':'), ensure_ascii=False)
        elif action == "format":
            parsed = json.loads(data)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        return f"未知操作: {action}"
    except Exception as e:
        return f"JSON 处理失败: {e}"


def _calculator(expression: str) -> str:
    """数学计算器"""
    try:
        # 创建安全计算环境
        allowed_names = {
            "abs": abs, "round": round, "min": min, "max": max,
            "sum": sum, "pow": pow, "sqrt": math.sqrt,
            "sin": math.sin, "cos": math.cos, "tan": math.tan,
            "pi": math.pi, "e": math.e, "log": math.log,
            "log10": math.log10, "floor": math.floor, "ceil": math.ceil,
            "radians": math.radians, "degrees": math.degrees,
        }
        # 对表达式进行安全过滤
        safe_expr = expression.replace("×", "*").replace("÷", "/").replace("^", "**")
        result = eval(safe_expr, {"__builtins__": {}}, allowed_names)
        return f"{expression} = {result}"
    except Exception as e:
        return f"计算错误: {e}"


def _unit_convert(value: float, from_unit: str, to_unit: str, category: str = "length") -> str:
    """单位转换"""
    # 长度转换基准（米）
    length_units = {
        "mm": 0.001, "cm": 0.01, "dm": 0.1, "m": 1, "km": 1000,
        "in": 0.0254, "ft": 0.3048, "yd": 0.9144, "mi": 1609.344,
    }
    # 重量转换基准（千克）
    weight_units = {
        "mg": 0.000001, "g": 0.001, "kg": 1, "t": 1000,
        "oz": 0.0283495, "lb": 0.453592, "st": 6.35029,
    }
    # 温度
    temperature_units = {"c": "celsius", "f": "fahrenheit", "k": "kelvin"}
    # 体积（升）
    volume_units = {
        "ml": 0.001, "l": 1, "m3": 1000, "gal": 3.78541, "qt": 0.946353,
        "pt": 0.473176, "cup": 0.236588, "fl_oz": 0.0295735,
    }

    try:
        if category == "length" and from_unit in length_units and to_unit in length_units:
            meters = value * length_units[from_unit]
            result = meters / length_units[to_unit]
        elif category == "weight" and from_unit in weight_units and to_unit in weight_units:
            kg = value * weight_units[from_unit]
            result = kg / weight_units[to_unit]
        elif category == "temperature":
            if from_unit.lower() in temperature_units and to_unit.lower() in temperature_units:
                f = from_unit.lower()
                t = to_unit.lower()
                # 统一转 Kelvin
                if f == "c": kelvin = value + 273.15
                elif f == "f": kelvin = (value - 32) * 5/9 + 273.15
                else: kelvin = value
                if t == "c": result = kelvin - 273.15
                elif t == "f": result = (kelvin - 273.15) * 9/5 + 32
                else: result = kelvin
        elif category == "volume" and from_unit in volume_units and to_unit in volume_units:
            liters = value * volume_units[from_unit]
            result = liters / volume_units[to_unit]
        else:
            return f"不支持的转换: {category} {from_unit} → {to_unit}"

        return f"{value} {from_unit} = {result:.6f} {to_unit}"
    except Exception as e:
        return f"转换失败: {e}"


def _date_time(action: str = "now", date_str: str = "", days: int = 0, format: str = "%Y-%m-%d %H:%M:%S") -> str:
    """日期时间工具"""
    now = datetime.now()
    try:
        if action == "now":
            return f"当前时间: {now.strftime(format)}"
        elif action == "add_days" and date_str:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            result = dt + timedelta(days=days)
            return f"{date_str} + {days}天 = {result.strftime('%Y-%m-%d')}"
        elif action == "diff" and date_str:
            other = datetime.strptime(date_str, "%Y-%m-%d")
            diff = (other - now.replace(hour=0, minute=0, second=0, microsecond=0)).days
            return f"{date_str} 距今 {'已过' if diff < 0 else '还有'} {abs(diff)} 天"
        elif action == "format" and date_str:
            from datetime import datetime as dt_func
            # 尝试多种格式解析
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
                try:
                    parsed = dt_func.strptime(date_str, fmt)
                    return parsed.strftime(format)
                except:
                    continue
            return f"无法解析日期: {date_str}"
        return f"未知操作: {action}"
    except Exception as e:
        return f"日期处理失败: {e}"


def _hash_tool(text: str, algorithm: str = "sha256") -> str:
    """哈希计算"""
    algorithms = {
        "md5": hashlib.md5, "sha1": hashlib.sha1,
        "sha256": hashlib.sha256, "sha512": hashlib.sha512,
    }
    if algorithm not in algorithms:
        return f"不支持的算法: {algorithm}，支持: {', '.join(algorithms.keys())}"
    try:
        h = algorithms[algorithm](text.encode())
        return f"{algorithm}: {h.hexdigest()}"
    except Exception as e:
        return f"哈希计算失败: {e}"


TOOLS = [
    ToolDef(name="json_tool", description="解析、格式化、验证、压缩 JSON 数据", category="数据处理",
        parameters={"type": "object", "properties": {
            "data": {"type": "string", "description": "JSON 字符串"},
            "action": {"type": "string", "description": "操作: parse/validate/minify/format", "default": "parse"},
        }, "required": ["data"]},
        handler=_json_tool),
    ToolDef(name="calculator", description="执行数学计算，支持 +-*/ 和常用数学函数（sin/cos/sqrt 等）", category="数据处理",
        parameters={"type": "object", "properties": {
            "expression": {"type": "string", "description": "数学表达式，如 2 + 3 * 4, sqrt(16), sin(30)"},
        }, "required": ["expression"]},
        handler=_calculator),
    ToolDef(name="unit_convert", description="单位转换（长度/重量/温度/体积）", category="数据处理",
        parameters={"type": "object", "properties": {
            "value": {"type": "number", "description": "数值"},
            "from_unit": {"type": "string", "description": "原单位（如 m, km, kg, lb, c, f, l, gal）"},
            "to_unit": {"type": "string", "description": "目标单位"},
            "category": {"type": "string", "description": "类别: length/weight/temperature/volume", "default": "length"},
        }, "required": ["value", "from_unit", "to_unit"]},
        handler=_unit_convert),
    ToolDef(name="date_time", description="日期时间工具：获取当前时间、日期计算、日期差值、格式转换", category="数据处理",
        parameters={"type": "object", "properties": {
            "action": {"type": "string", "description": "操作: now/add_days/diff/format", "default": "now"},
            "date_str": {"type": "string", "description": "日期字符串（YYYY-MM-DD）"},
            "days": {"type": "integer", "description": "加减天数（add_days 时使用）", "default": 0},
            "format": {"type": "string", "description": "输出格式", "default": "%Y-%m-%d %H:%M:%S"},
        }, "required": []},
        handler=_date_time),
    ToolDef(name="hash_tool", description="计算文本的 MD5/SHA1/SHA256/SHA512 哈希值", category="数据处理",
        parameters={"type": "object", "properties": {
            "text": {"type": "string", "description": "要计算哈希的文本"},
            "algorithm": {"type": "string", "description": "算法: md5/sha1/sha256/sha512", "default": "sha256"},
        }, "required": ["text"]},
        handler=_hash_tool),
]
