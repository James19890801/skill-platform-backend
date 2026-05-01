"""
媒体工具 - QR 码生成、图表生成、Markdown 转换
"""

import os
import re
from typing import Any, Dict, List, Optional
from . import ToolDef


# ─── QR 码生成 ───
try:
    import qrcode
    HAS_QR = True
except ImportError:
    HAS_QR = False


def _qr_code(data: str, size: int = 10, border: int = 2) -> str:
    """生成 QR 码并保存为图片"""
    if not HAS_QR:
        return "需要安装 qrcode 包: pip install qrcode[pil]"
    try:
        output_dir = os.path.join(os.getcwd(), "output")
        os.makedirs(output_dir, exist_ok=True)
        filename = f"qrcode_{abs(hash(data)) % 10000}.png"
        filepath = os.path.join(output_dir, filename)

        qr = qrcode.QRCode(box_size=size, border=border)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filepath)

        return f"QR 码已生成: {filepath}\n内容: {data[:200]}{'...' if len(data) > 200 else ''}"
    except Exception as e:
        return f"QR 码生成失败: {e}"


# ─── 图表生成 ───
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MPL = True
except ImportError:
    HAS_MPL = False


def _chart_gen(chart_type: str, title: str, labels: List[str], values: List[float],
               filename: Optional[str] = None) -> str:
    """生成数据图表"""
    if not HAS_MPL:
        return "需要安装 matplotlib: pip install matplotlib"
    try:
        output_dir = os.path.join(os.getcwd(), "output")
        os.makedirs(output_dir, exist_ok=True)
        fname = filename or f"chart_{abs(hash(str(labels))) % 10000}.png"
        filepath = os.path.join(output_dir, fname)

        plt.figure(figsize=(10, 6))

        if chart_type == "bar":
            colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
            bars = plt.bar(labels, values, color=colors[:len(labels)])
            for bar, val in zip(bars, values):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
                         str(val), ha='center', va='bottom', fontsize=10)
        elif chart_type == "pie":
            plt.pie(values, labels=labels, autopct='%1.1f%%', startangle=90)
            plt.axis('equal')
        elif chart_type == "line":
            plt.plot(labels, values, marker='o', linewidth=2, color='#6366f1')
            plt.fill_between(range(len(values)), values, alpha=0.1, color='#6366f1')
            for i, v in enumerate(values):
                plt.text(i, v + 0.3, str(v), ha='center', fontsize=10)
        elif chart_type == "horizontal_bar":
            colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
            bars = plt.barh(labels, values, color=colors[:len(labels)])
            for bar, val in zip(bars, values):
                plt.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                         str(val), ha='left', va='center', fontsize=10)

        plt.title(title, fontsize=14, pad=15)
        plt.tight_layout()
        plt.savefig(filepath, dpi=120)
        plt.close()

        return f"图表已生成: {filepath}\n类型: {chart_type}\n标题: {title}"
    except Exception as e:
        plt.close()
        return f"图表生成失败: {e}"


# ─── Markdown 转换 ───
try:
    import markdown as md_lib
    HAS_MD = True
except ImportError:
    HAS_MD = False


def _markdown_convert(text: str, to_format: str = "html") -> str:
    """Markdown 格式转换"""
    try:
        if to_format == "html":
            if HAS_MD:
                html = md_lib.markdown(text, extensions=['extra', 'codehilite', 'tables'])
                return html[:10000] + ("\n\n...(过长已截断)" if len(html) > 10000 else "")
            else:
                # 简易转换
                html = text
                html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.M)
                html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.M)
                html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.M)
                html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
                html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
                html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)
                html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.M)
                return f"<div>{html}</div>"
        elif to_format == "plain":
            # 去除 markdown 标记
            plain = text
            plain = re.sub(r'^### |^## |^# ', '', plain, flags=re.M)
            plain = re.sub(r'\*\*(.+?)\*\*', r'\1', plain)
            plain = re.sub(r'\*(.+?)\*', r'\1', plain)
            plain = re.sub(r'`(.+?)`', r'\1', plain)
            plain = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', plain)
            plain = re.sub(r'^[|-]+$', '', plain, flags=re.M)
            return plain.strip()
        return f"不支持的目标格式: {to_format}"
    except Exception as e:
        return f"Markdown 转换失败: {e}"


TOOLS = [
    ToolDef(name="qr_code", description="生成 QR 二维码图片并保存到本地", category="媒体",
        parameters={"type": "object", "properties": {
            "data": {"type": "string", "description": "二维码内容（URL/文本等）"},
            "size": {"type": "integer", "description": "像素大小", "default": 10},
        }, "required": ["data"]},
        handler=_qr_code),
    ToolDef(name="chart_gen", description="生成数据图表（柱状图/饼图/折线图/横向柱状图）保存为图片", category="媒体",
        parameters={"type": "object", "properties": {
            "chart_type": {"type": "string", "description": "图表类型: bar/pie/line/horizontal_bar"},
            "title": {"type": "string", "description": "图表标题"},
            "labels": {"type": "array", "items": {"type": "string"}, "description": "数据标签列表"},
            "values": {"type": "array", "items": {"type": "number"}, "description": "数据值列表"},
            "filename": {"type": "string", "description": "文件名（可选）"},
        }, "required": ["chart_type", "title", "labels", "values"]},
        handler=_chart_gen),
    ToolDef(name="markdown_convert", description="Markdown 与 HTML 或纯文本之间的格式转换", category="媒体",
        parameters={"type": "object", "properties": {
            "text": {"type": "string", "description": "Markdown 文本"},
            "to_format": {"type": "string", "description": "目标格式: html/plain", "default": "html"},
        }, "required": ["text"]},
        handler=_markdown_convert),
]
