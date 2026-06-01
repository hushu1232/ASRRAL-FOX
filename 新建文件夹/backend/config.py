"""
AstralFox Backend Configuration
================================
Reads API keys and service settings from environment variables.
Copy .env.example to .env and fill in your keys.
"""
import os
from dotenv import load_dotenv

load_dotenv()


# ── Azure Speech Services (ASR + TTS) ─────────────────────────

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastasia")
ASR_LANGUAGE = os.getenv("ASR_LANGUAGE", "zh-CN")

# ── OpenAI ────────────────────────────────────────────────────

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")  # optional, for proxies

# ── TTS ───────────────────────────────────────────────────────

TTS_PROVIDER = os.getenv("TTS_PROVIDER", "edge")  # "azure" or "edge"
TTS_VOICE = os.getenv("TTS_VOICE", "zh-CN-XiaohanNeural")  # 成熟优雅女声，适合赤城
TTS_RATE = os.getenv("TTS_RATE", "+0%")  # speaking rate adjustment
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "")  # custom ffmpeg path, auto-detected if empty

# ── Function Tools ───────────────────────────────────────────

QWEATHER_API_KEY = os.getenv("QWEATHER_API_KEY", "")  # 和风天气 API key (免费)
BING_SEARCH_API_KEY = os.getenv("BING_SEARCH_API_KEY", "")  # Bing Search API v7

# ── Server ────────────────────────────────────────────────────

SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8765"))

# ── Validation ────────────────────────────────────────────────

def check_config():
    """Validate required configuration. Returns list of warnings."""
    warnings = []

    if not AZURE_SPEECH_KEY:
        warnings.append("AZURE_SPEECH_KEY not set — ASR will fall back to mock")
    if not AZURE_SPEECH_REGION:
        warnings.append("AZURE_SPEECH_REGION not set")
    if not OPENAI_API_KEY:
        warnings.append("OPENAI_API_KEY not set — LLM will fall back to mock")
    if not QWEATHER_API_KEY:
        warnings.append("QWEATHER_API_KEY not set — weather will use mock data")
    if not BING_SEARCH_API_KEY:
        warnings.append("BING_SEARCH_API_KEY not set — web search will use mock data")

    if TTS_PROVIDER not in ("azure", "edge"):
        warnings.append(f"Unknown TTS_PROVIDER '{TTS_PROVIDER}' — using edge")

    return warnings
