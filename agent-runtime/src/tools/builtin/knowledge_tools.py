"""
知识工具 - 单词查询、翻译、ASCII 码表、IP 信息等
"""

from typing import Any, Dict, List, Optional
from . import ToolDef

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


def _translate(text: str, target_lang: str = "zh", source_lang: Optional[str] = None) -> str:
    """文本翻译（使用免费翻译 API）"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        # 使用 mymemory 免费翻译 API
        params = {"q": text, "langpair": f"{source_lang or 'auto'}|{target_lang}"}
        resp = httpx.get("https://api.mymemory.translated.net/get", params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            translated = data.get("responseData", {}).get("translatedText", "")
            if translated:
                return f"翻译结果:\n{text}\n→\n{translated}"
            return "翻译失败：无返回结果"
        return f"翻译失败: HTTP {resp.status_code}"
    except Exception as e:
        return f"翻译失败: {e}"


def _dictionary(word: str, lang: str = "en") -> str:
    """在线词典查询（英语单词释义）"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        if lang == "en":
            resp = httpx.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()[0]
                word_info = data
                phonetic = word_info.get('phonetic', word_info.get('phonetics', [{}])[0].get('text', ''))
                meanings = word_info.get('meanings', [])
                result = f"📖 {word} {phonetic}\n"
                for m in meanings[:3]:
                    result += f"\n[{m.get('partOfSpeech', '未知')}]\n"
                    for d in m.get('definitions', [])[:3]:
                        result += f"  • {d.get('definition', '')}\n"
                        if d.get('example'):
                            result += f"    例: {d['example']}\n"
                return result
            return f"未找到单词: {word}"
        else:
            return "目前仅支持英语词典"
    except Exception as e:
        return f"词典查询失败: {e}"


def _user_agent_info() -> str:
    """获取用户代理信息（系统信息）"""
    import platform
    try:
        system = platform.system()
        release = platform.release()
        version = platform.version()
        machine = platform.machine()
        processor = platform.processor()
        python = platform.python_version()
        hostname = platform.node()

        return (f"💻 系统信息\n"
                f"系统: {system} {release}\n"
                f"版本: {version}\n"
                f"架构: {machine}\n"
                f"处理器: {processor}\n"
                f"主机名: {hostname}\n"
                f"Python: {python}")
    except Exception as e:
        return f"获取系统信息失败: {e}"


TOOLS = [
    ToolDef(name="translate", description="文本翻译（支持多语言，使用免费翻译服务）", category="知识",
        parameters={"type": "object", "properties": {
            "text": {"type": "string", "description": "要翻译的文本"},
            "target_lang": {"type": "string", "description": "目标语言代码（zh/en/ja/fr/de/es 等）", "default": "zh"},
            "source_lang": {"type": "string", "description": "源语言代码（自动检测可不填）"},
        }, "required": ["text"]},
        handler=_translate),
    ToolDef(name="dictionary", description="英语词典查询，获取单词释义、音标和例句", category="知识",
        parameters={"type": "object", "properties": {
            "word": {"type": "string", "description": "要查询的英语单词"},
            "lang": {"type": "string", "description": "语言", "default": "en"},
        }, "required": ["word"]},
        handler=_dictionary),
    ToolDef(name="system_info", description="获取当前系统信息（操作系统、架构、Python 版本等）", category="知识",
        parameters={"type": "object", "properties": {}, "required": []},
        handler=_user_agent_info),
]
