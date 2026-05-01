"""
网页抓取工具 - HTTP 请求、网页内容提取、RSS 阅读
"""

from typing import Any, Dict, List
from . import ToolDef

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


def _web_fetch(url: str, timeout: int = 15) -> str:
    """获取网页 HTML 内容"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "text" in content_type or "html" in content_type or "json" in content_type:
            return resp.text[:10000] + ("\n\n...(内容过长已截断)" if len(resp.text) > 10000 else "")
        return f"[二进制内容] Content-Type: {content_type}, 大小: {len(resp.content)} bytes"
    except Exception as e:
        return f"网页获取失败: {e}"


def _web_scrape(url: str, extract_links: bool = False) -> str:
    """抓取网页并提取正文文本"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    if not HAS_BS4:
        return "需要安装 beautifulsoup4 包"
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        # 移除 script、style 等
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
            tag.decompose()
        text = soup.get_text(separator='\n', strip=True)
        text = '\n'.join(line for line in text.split('\n') if len(line.strip()) > 2)
        text = text[:8000] + ("\n\n...(截断)" if len(text) > 8000 else "")

        result = f"标题: {soup.title.string.strip() if soup.title else '无标题'}\n\n正文:\n{text}"
        if extract_links:
            links = []
            for a in soup.find_all('a', href=True)[:20]:
                href = a['href']
                txt = a.get_text(strip=True)
                if txt and href and not href.startswith('#') and not href.startswith('javascript'):
                    links.append(f"{txt}: {href}")
            if links:
                result += f"\n\n---\n链接 ({len(links)}):\n" + "\n".join(links)
        return result
    except Exception as e:
        return f"网页抓取失败: {e}"


def _rss_feed(url: str, count: int = 5) -> str:
    """读取 RSS Feed"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        from xml.etree import ElementTree
        root = ElementTree.fromstring(resp.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom', 'rss': '', 'dc': 'http://purl.org/dc/elements/1.1/'}
        items = root.findall('.//item') or root.findall('.//atom:entry', ns)
        if not items:
            # 尝试通用查找
            items = root.findall('.//{http://www.w3.org/2005/Atom}entry')
        results = []
        for i, item in enumerate(items[:count]):
            title = item.findtext('title', '') or item.findtext('{http://www.w3.org/2005/Atom}title', '')
            link = item.findtext('link', '') or (item.find('{http://www.w3.org/2005/Atom}link').get('href', '') if item.find('{http://www.w3.org/2005/Atom}link') is not None else '')
            desc = item.findtext('description', '') or item.findtext('{http://www.w3.org/2005/Atom}summary', '')
            desc = desc[:200] if desc else ''
            results.append(f"{i+1}. {title}\n   {desc}\n   {link}")
        return "\n\n".join(results) if results else "未找到 RSS 条目"
    except Exception as e:
        return f"RSS 读取失败: {e}"


TOOLS = [
    ToolDef(
        name="web_fetch",
        description="获取网页的原始 HTML 内容，适合抓取 API 返回的 JSON 或简单页面",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "网页 URL"},
                "timeout": {"type": "integer", "description": "超时秒数", "default": 15},
            },
            "required": ["url"],
        },
        category="网页抓取",
        handler=_web_fetch,
    ),
    ToolDef(
        name="web_scrape",
        description="抓取网页并提取纯文本正文内容，自动去除导航/广告等干扰元素",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "网页 URL"},
                "extract_links": {"type": "boolean", "description": "是否提取页面中的链接", "default": False},
            },
            "required": ["url"],
        },
        category="网页抓取",
        handler=_web_scrape,
    ),
    ToolDef(
        name="rss_feed",
        description="读取 RSS/Atom Feed 获取最新文章列表",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "RSS Feed URL"},
                "count": {"type": "integer", "description": "获取条目数量", "default": 5},
            },
            "required": ["url"],
        },
        category="网页抓取",
        handler=_rss_feed,
    ),
]
