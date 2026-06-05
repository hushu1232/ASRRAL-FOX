"""
GPT Function Tools
==================
Function definitions and handlers for GPT-4o function calling.

Available tools:
  - get_weather  : QWeather API (和风天气) with mock fallback
  - search_web   : Bing Search API v7 with mock fallback
  - set_reminder : asyncio timer → WebSocket notification

Each tool gracefully degrades to mock when the API key is not configured.
"""
import asyncio
import logging
import json
import re
import urllib.request
import urllib.parse
from typing import Any, Callable, Awaitable
from datetime import datetime, timedelta

from config import QWEATHER_API_KEY, BING_SEARCH_API_KEY

logger = logging.getLogger("tools")

# ── Tool Registry ──────────────────────────────────────────────

_registry: dict[str, callable] = {}

def register(name: str):
    """Decorator to register a tool handler."""
    def wrapper(fn):
        _registry[name] = fn
        return fn
    return wrapper

async def execute_tool(name: str, arguments: dict) -> str:
    """Execute a registered tool and return the result as a JSON string."""
    handler = _registry.get(name)
    if handler is None:
        return json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)
    try:
        result = await handler(**arguments)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Tool '{name}' failed: {e}")
        return json.dumps({"error": str(e)}, ensure_ascii=False)


# ── Reminder Callback System ───────────────────────────────────

# Per-connection callbacks: ws_id → async callback function
_reminder_callbacks: dict[str, Callable[[dict], Awaitable[None]]] = {}
_reminder_counter: int = 0

def register_reminder_callback(ws_id: str, callback: Callable[[dict], Awaitable[None]]):
    """Register a reminder notification callback for a WebSocket connection."""
    _reminder_callbacks[ws_id] = callback

def unregister_reminder_callback(ws_id: str):
    """Remove callback when WebSocket disconnects."""
    _reminder_callbacks.pop(ws_id, None)

async def _notify_reminder(reminder: dict):
    """Send reminder notification to all connected clients."""
    for ws_id, callback in list(_reminder_callbacks.items()):
        try:
            await callback(reminder)
        except Exception as e:
            logger.error(f"Reminder callback {ws_id} failed: {e}")
            unregister_reminder_callback(ws_id)


# ── Function Definitions (OpenAI format) ────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息，包括温度、天气状况和湿度",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如 北京、上海、东京"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "搜索网络获取最新信息，用于回答实时问题或用户需要最新资讯时",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "为用户设置一个提醒事项，到时间会通过桌面通知提醒用户",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "提醒的标题/内容"
                    },
                    "time": {
                        "type": "string",
                        "description": "提醒时间，格式如 '2026-05-24 15:00' 或 '5分钟后' 或 '30秒后'"
                    }
                },
                "required": ["title", "time"]
            }
        }
    }
]

# ── Time String Parser ─────────────────────────────────────────

def _parse_reminder_time(time_str: str) -> float:
    """
    Parse a reminder time string and return delay in seconds.
    Supports:
      - Relative: "5分钟后", "30秒后", "1小时后", "明天下午3点"
      - Absolute: "2026-05-24 15:00"
    Returns delay in seconds from now. Raises ValueError if unparseable.
    """
    time_str = time_str.strip()

    # Relative patterns
    m = re.match(r'(\d+)\s*秒后', time_str)
    if m:
        return float(m.group(1))

    m = re.match(r'(\d+)\s*分钟后', time_str)
    if m:
        return float(m.group(1)) * 60

    m = re.match(r'(\d+)\s*小时后', time_str)
    if m:
        return float(m.group(1)) * 3600

    # Absolute datetime: "2026-05-24 15:00" or "2026-05-24T15:00"
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            target = datetime.strptime(time_str, fmt)
            delay = (target - datetime.now()).total_seconds()
            if delay < 0:
                raise ValueError(f"Time {time_str} is in the past")
            return delay
        except ValueError:
            continue

    raise ValueError(f"Cannot parse reminder time: {time_str}")


# ── Tool Handlers ───────────────────────────────────────────────

@register("get_weather")
async def handle_get_weather(city: str) -> dict:
    """
    Get current weather via QWeather API (和风天气).
    Falls back to mock data if API key is not configured.
    """
    logger.info(f"get_weather: {city} (key={'set' if QWEATHER_API_KEY else 'mock'})")

    if not QWEATHER_API_KEY:
        return await _mock_weather(city)

    try:
        # Step 1: city lookup → location ID
        geo_url = f"https://geoapi.qweather.com/v2/city/lookup?location={urllib.parse.quote(city)}&key={QWEATHER_API_KEY}"
        geo_data = await asyncio.to_thread(lambda: json.loads(
            urllib.request.urlopen(geo_url, timeout=5).read()
        ))

        if geo_data.get("code") != "200" or not geo_data.get("location"):
            logger.warning(f"QWeather city lookup failed for {city}: {geo_data}")
            return await _mock_weather(city)

        loc = geo_data["location"][0]
        loc_id = loc["id"]
        city_name = loc.get("name", city)

        # Step 2: current weather
        weather_url = f"https://devapi.qweather.com/v7/weather/now?location={loc_id}&key={QWEATHER_API_KEY}"
        weather_data = await asyncio.to_thread(lambda: json.loads(
            urllib.request.urlopen(weather_url, timeout=5).read()
        ))

        if weather_data.get("code") != "200" or not weather_data.get("now"):
            logger.warning(f"QWeather now failed: {weather_data}")
            return await _mock_weather(city)

        now = weather_data["now"]
        return {
            "city": city_name,
            "temperature": int(now["temp"]),
            "condition": now["text"],
            "humidity": int(now["humidity"]),
            "wind_dir": now.get("windDir", ""),
            "source": "和风天气",
        }

    except Exception as e:
        logger.error(f"QWeather error: {e}")
        return await _mock_weather(city)


async def _mock_weather(city: str) -> dict:
    """Mock weather data for offline/testing."""
    await asyncio.sleep(0.2)
    import random
    conditions = ["晴", "多云", "阴", "小雨", "阵雨", "晴间多云"]
    return {
        "city": city,
        "temperature": random.randint(15, 35),
        "condition": random.choice(conditions),
        "humidity": random.randint(30, 90),
        "source": "mock",
    }


@register("search_web")
async def handle_search_web(query: str) -> dict:
    """
    Search the web via Bing Search API v7.
    Falls back to mock results if API key is not configured.
    """
    logger.info(f"search_web: {query} (key={'set' if BING_SEARCH_API_KEY else 'mock'})")

    if not BING_SEARCH_API_KEY:
        return await _mock_search(query)

    try:
        url = f"https://api.bing.microsoft.com/v7.0/search?q={urllib.parse.quote(query)}&count=5&mkt=zh-CN"
        req = urllib.request.Request(url, headers={"Ocp-Apim-Subscription-Key": BING_SEARCH_API_KEY})
        data = await asyncio.to_thread(lambda: json.loads(
            urllib.request.urlopen(req, timeout=8).read()
        ))

        results = []
        for page in (data.get("webPages", {}).get("value", []) or [])[:5]:
            results.append({
                "title": page.get("name", ""),
                "snippet": page.get("snippet", ""),
                "url": page.get("url", ""),
            })

        if not results:
            return await _mock_search(query)

        return {
            "query": query,
            "results": results,
            "source": "Bing Search",
        }

    except Exception as e:
        logger.error(f"Bing Search error: {e}")
        return await _mock_search(query)


async def _mock_search(query: str) -> dict:
    """Mock search results for offline/testing."""
    await asyncio.sleep(0.3)
    return {
        "query": query,
        "results": [
            {
                "title": f"关于「{query}」的搜索结果 1",
                "snippet": f"这是关于{query}的模拟搜索结果。配置 BING_SEARCH_API_KEY 可获取真实搜索。",
                "url": "https://example.com/result1",
            },
            {
                "title": f"关于「{query}」的搜索结果 2",
                "snippet": f"另一个关于{query}的模拟结果。真实搜索可获取最新资讯。",
                "url": "https://example.com/result2",
            },
        ],
        "source": "mock",
    }


@register("set_reminder")
async def handle_set_reminder(title: str, time: str) -> dict:
    """
    Set a real reminder using asyncio timer.
    When the timer fires, sends notification via registered WebSocket callbacks.
    """
    logger.info(f"set_reminder: [{time}] {title}")

    try:
        delay = _parse_reminder_time(time)
    except ValueError as e:
        return {"success": False, "error": str(e), "title": title, "time": time}

    if delay > 86400 * 7:  # max 7 days
        return {"success": False, "error": "提醒时间不能超过7天", "title": title, "time": time}
    if delay < 1:
        return {"success": False, "error": "提醒时间已过，请设置未来的时间", "title": title, "time": time}

    global _reminder_counter
    _reminder_counter += 1
    reminder_id = f"rem_{_reminder_counter}"
    fire_at = datetime.now() + timedelta(seconds=delay)

    logger.info(f"Reminder {reminder_id}: '{title}' fires at {fire_at} (in {delay:.0f}s)")

    async def _fire():
        await asyncio.sleep(delay)
        logger.info(f"Reminder {reminder_id} FIRING: {title}")
        await _notify_reminder({
            "type": "reminder",
            "id": reminder_id,
            "title": title,
            "time": time,
        })

    asyncio.create_task(_fire())

    return {
        "success": True,
        "title": title,
        "time": time,
        "delay_seconds": int(delay),
        "fire_at": fire_at.strftime("%Y-%m-%d %H:%M:%S"),
        "message": f"已设置提醒：{time} — {title}",
    }


# ── Tool Name List ──────────────────────────────────────────────

def get_tool_names() -> list[str]:
    """Return list of registered tool names."""
    return list(_registry.keys())
