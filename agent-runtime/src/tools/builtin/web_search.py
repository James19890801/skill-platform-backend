"""
Web 搜索工具 - DuckDuckGo、Wikipedia、Arxiv、HackerNews
"""

from typing import Any, Dict, List
from . import ToolDef

# ─── DuckDuckGo 搜索 ───
try:
    from duckduckgo_search import DDGS
    HAS_DDG = True
except ImportError:
    HAS_DDG = False


def _web_search(query: str, max_results: int = 5) -> str:
    """使用 DuckDuckGo 搜索网络"""
    if not HAS_DDG:
        return "需要安装 duckduckgo-search 包: pip install duckduckgo-search"
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        if not results:
            return "未找到相关结果"
        lines = []
        for i, r in enumerate(results, 1):
            title = r.get('title', '')
            body = r.get('body', '')
            href = r.get('href', '')
            lines.append(f"{i}. {title}\n   {body}\n   {href}")
        return "\n\n".join(lines)
    except Exception as e:
        return f"搜索失败: {e}"


# ─── Wikipedia ───
try:
    import wikipedia
    HAS_WIKI = True
except ImportError:
    try:
        import wikipediaapi
        HAS_WIKI = False  # will use fallback
    except ImportError:
        HAS_WIKI = False


def _wikipedia_search(query: str, lang: str = "zh") -> str:
    """搜索 Wikipedia"""
    try:
        import wikipedia
        wikipedia.set_lang(lang)
        results = wikipedia.search(query)
        if not results:
            return "未找到相关条目"
        summary = wikipedia.summary(results[0], sentences=5)
        page = wikipedia.page(results[0])
        return f"标题: {results[0]}\nURL: {page.url}\n\n摘要:\n{summary}"
    except Exception as e:
        return f"Wikipedia 查询失败: {e}"


# ─── Arxiv ───
try:
    import arxiv
    HAS_ARXIV = True
except ImportError:
    HAS_ARXIV = False


def _arxiv_search(query: str, max_results: int = 5) -> str:
    """搜索 Arxiv 学术论文"""
    if not HAS_ARXIV:
        return "需要安装 arxiv 包: pip install arxiv"
    try:
        client = arxiv.Client()
        search = arxiv.Search(query=query, max_results=max_results)
        results = []
        for r in client.results(search):
            results.append(
                f"标题: {r.title}\n"
                f"作者: {', '.join(a.name for a in r.authors[:5])}\n"
                f"日期: {r.published.strftime('%Y-%m-%d')}\n"
                f"摘要: {r.summary[:300]}...\n"
                f"链接: {r.entry_id}"
            )
        return "\n\n---\n\n".join(results) if results else "未找到相关论文"
    except Exception as e:
        return f"Arxiv 搜索失败: {e}"


# ─── HackerNews ───
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def _hackernews_top(story_type: str = "top", count: int = 10) -> str:
    """获取 HackerNews 热门文章"""
    if not HAS_REQUESTS:
        return "需要安装 requests 包"
    try:
        type_map = {"top": "topstories", "new": "newstories", "best": "beststories", "ask": "askstories", "show": "showstories"}
        endpoint = type_map.get(story_type, "topstories")
        resp = requests.get(f"https://hacker-news.firebaseio.com/v0/{endpoint}.json", timeout=10)
        ids = resp.json()[:count]
        results = []
        for i, item_id in enumerate(ids, 1):
            item = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json", timeout=10).json()
            title = item.get('title', 'Untitled')
            url = item.get('url', f"https://news.ycombinator.com/item?id={item_id}")
            score = item.get('score', 0)
            by = item.get('by', 'unknown')
            results.append(f"{i}. [{score}分] {title}\n   作者: {by} | 链接: {url}")
        return "\n\n".join(results)
    except Exception as e:
        return f"HackerNews 获取失败: {e}"


TOOLS = [
    ToolDef(
        name="web_search",
        description="通过网络搜索引擎搜索信息（DuckDuckGo），适合查找最新资讯、网页内容",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "description": "返回结果数量", "default": 5},
            },
            "required": ["query"],
        },
        category="搜索",
        handler=_web_search,
    ),
    ToolDef(
        name="wikipedia",
        description="查询 Wikipedia 百科内容，获取词条摘要和链接",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索词条"},
                "lang": {"type": "string", "description": "语言代码（zh/en/ja等）", "default": "zh"},
            },
            "required": ["query"],
        },
        category="搜索",
        handler=_wikipedia_search,
    ),
    ToolDef(
        name="arxiv_search",
        description="搜索 Arxiv 学术论文数据库，适合查找计算机科学、数学、物理学等论文",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "论文搜索关键词"},
                "max_results": {"type": "integer", "description": "返回结果数量", "default": 5},
            },
            "required": ["query"],
        },
        category="搜索",
        handler=_arxiv_search,
    ),
    ToolDef(
        name="hackernews",
        description="获取 HackerNews 热门文章（top/new/best/ask/show）",
        parameters={
            "type": "object",
            "properties": {
                "story_type": {"type": "string", "description": "文章类型: top/new/best/ask/show", "default": "top"},
                "count": {"type": "integer", "description": "获取数量", "default": 10},
            },
            "required": [],
        },
        category="搜索",
        handler=_hackernews_top,
    ),
]
