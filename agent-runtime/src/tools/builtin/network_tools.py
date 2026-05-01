"""
网络工具 - HTTP 请求、IP 地理定位、URL 缩短、天气、汇率
"""

from typing import Any, Dict, List, Optional
from . import ToolDef

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


def _http_request(url: str, method: str = "GET", headers: Optional[Dict] = None,
                  body: Optional[str] = None) -> str:
    """通用 HTTP 请求工具"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            if method.upper() == "GET":
                resp = client.get(url, headers=headers or {})
            elif method.upper() == "POST":
                resp = client.post(url, headers=headers or {}, content=body)
            elif method.upper() == "PUT":
                resp = client.put(url, headers=headers or {}, content=body)
            elif method.upper() == "DELETE":
                resp = client.delete(url, headers=headers or {})
            else:
                return f"不支持的 HTTP 方法: {method}"

            content = resp.text[:5000]
            if len(resp.text) > 5000:
                content += "\n\n...(响应体过长已截断)"

            return (f"HTTP {method} {url}\n"
                    f"状态码: {resp.status_code}\n"
                    f"响应头: {dict(resp.headers)}\n\n"
                    f"响应体:\n{content}")
    except Exception as e:
        return f"HTTP 请求失败: {e}"


def _ip_geo(ip: str = "") -> str:
    """IP 地理定位"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        url = f"http://ip-api.com/json/{ip}" if ip else "http://ip-api.com/json/"
        resp = httpx.get(url, timeout=10)
        data = resp.json()
        if data.get("status") == "success":
            return (f"IP: {data.get('query', ip)}\n"
                    f"国家: {data.get('country', '')}\n"
                    f"地区: {data.get('regionName', '')}\n"
                    f"城市: {data.get('city', '')}\n"
                    f"运营商: {data.get('isp', '')}\n"
                    f"经纬度: {data.get('lat', '')}, {data.get('lon', '')}")
        return f"查询失败: {data.get('message', '未知错误')}"
    except Exception as e:
        return f"IP 查询失败: {e}"


def _weather(city: str) -> str:
    """获取天气信息（通过 wttr.in）"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        resp = httpx.get(f"https://wttr.in/{city}?format=%C+%t+%h+%w&lang=zh", timeout=10)
        if resp.status_code == 200:
            return f"{city} 天气: {resp.text.strip()}"
        resp2 = httpx.get(f"https://wttr.in/{city}?format=j1", timeout=10)
        if resp2.status_code == 200:
            data = resp2.json()
            cc = data.get("current_condition", [{}])[0]
            return (f"{city} 天气\n"
                    f"温度: {cc.get('temp_C', 'N/A')}°C\n"
                    f"体感: {cc.get('FeelsLikeC', 'N/A')}°C\n"
                    f"湿度: {cc.get('humidity', 'N/A')}%\n"
                    f"风速: {cc.get('windspeedKmph', 'N/A')} km/h\n"
                    f"描述: {cc.get('weatherDesc', [{}])[0].get('value', 'N/A')}")
        return f"无法获取 {city} 的天气信息"
    except Exception as e:
        return f"天气查询失败: {e}"


def _currency_convert(amount: float = 1.0, from_currency: str = "USD", to_currency: str = "CNY") -> str:
    """货币汇率转换"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        # 使用免费汇率 API
        resp = httpx.get(f"https://api.exchangerate-api.com/v4/latest/{from_currency.upper()}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            rates = data.get("rates", {})
            target = to_currency.upper()
            if target in rates:
                rate = rates[target]
                result = amount * rate
                return f"{amount} {from_currency.upper()} = {result:.2f} {target} (汇率: 1 {from_currency.upper()} = {rate} {target})"
            return f"不支持的货币: {target}，可用: {', '.join(list(rates.keys())[:20])}..."
        return f"汇率查询失败: HTTP {resp.status_code}"
    except Exception as e:
        return f"汇率查询失败: {e}"


def _country_info(country: str) -> str:
    """国家信息查询"""
    if not HAS_HTTPX:
        return "需要安装 httpx 包"
    try:
        resp = httpx.get(f"https://restcountries.com/v3.1/name/{country}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()[0]
            name = data.get("name", {})
            currencies = data.get('currencies', {})
            currency_str = ', '.join(
                f"{c.get('name', '')} ({c.get('symbol', '')})"
                for c in currencies.values()
            )
            return (f"国家: {name.get('common', '')} ({name.get('official', '')})\n"
                    f"首都: {', '.join(data.get('capital', ['N/A']))}\n"
                    f"人口: {data.get('population', 'N/A'):,}\n"
                    f"面积: {data.get('area', 'N/A'):,} km²\n"
                    f"语言: {', '.join(data.get('languages', {}).values())}\n"
                    f"货币: {currency_str}\n"
                    f"时区: {', '.join(data.get('timezones', []))}\n"
                    f"域名: {', '.join(data.get('tld', []))}")
        return f"未找到国家信息: {country}"
    except Exception as e:
        return f"国家查询失败: {e}"


TOOLS = [
    ToolDef(name="http_request", description="发送 HTTP 请求（GET/POST/PUT/DELETE）", category="网络",
        parameters={"type": "object", "properties": {
            "url": {"type": "string", "description": "请求 URL"},
            "method": {"type": "string", "description": "HTTP 方法", "default": "GET"},
            "headers": {"type": "object", "description": "请求头（可选）"},
            "body": {"type": "string", "description": "请求体（POST/PUT 时使用）"},
        }, "required": ["url"]},
        handler=_http_request),
    ToolDef(name="ip_geo", description="查询 IP 地址的地理位置信息", category="网络",
        parameters={"type": "object", "properties": {
            "ip": {"type": "string", "description": "IP 地址，留空查自己", "default": ""},
        }, "required": []},
        handler=_ip_geo),
    ToolDef(name="weather", description="查询城市天气信息", category="网络",
        parameters={"type": "object", "properties": {
            "city": {"type": "string", "description": "城市名（中文或英文）"},
        }, "required": ["city"]},
        handler=_weather),
    ToolDef(name="currency_convert", description="货币汇率转换", category="网络",
        parameters={"type": "object", "properties": {
            "amount": {"type": "number", "description": "金额", "default": 1.0},
            "from_currency": {"type": "string", "description": "源货币代码（如 USD, CNY, EUR）", "default": "USD"},
            "to_currency": {"type": "string", "description": "目标货币代码", "default": "CNY"},
        }, "required": []},
        handler=_currency_convert),
    ToolDef(name="country_info", description="查询国家基本信息（首都、人口、语言、货币等）", category="网络",
        parameters={"type": "object", "properties": {
            "country": {"type": "string", "description": "国家名称（中文或英文）"},
        }, "required": ["country"]},
        handler=_country_info),
]
