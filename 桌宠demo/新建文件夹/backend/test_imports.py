"""Quick import validation — run with: python test_imports.py"""
import sys

ok = 0
fail = 0

def test(name, module):
    global ok, fail
    try:
        __import__(module)
        print(f"  OK: {name}")
        ok += 1
    except Exception as e:
        print(f"  FAIL: {name} — {e}")
        fail += 1

test("config", "config")
test("tools", "tools")
test("asr", "asr")
test("llm", "llm")
test("tts", "tts")

print()
print(f"Results: {ok} OK, {fail} FAIL")

# Check service status
from config import check_config
from asr import HAS_AZURE_SDK
from llm import HAS_LLM
from tts import HAS_EDGE_TTS, HAS_FFMPEG

print()
print("Service status:")
print(f"  Azure ASR:  {'ENABLED' if HAS_AZURE_SDK else 'mock'}")
print(f"  OpenAI LLM: {'ENABLED' if HAS_LLM else 'mock'}")
print(f"  edge-tts:   {'INSTALLED' if HAS_EDGE_TTS else 'MISSING'}")
print(f"  ffmpeg:     {'INSTALLED' if HAS_FFMPEG else 'MISSING'}")
print(f"  TTS:        {'ready' if (HAS_EDGE_TTS and HAS_FFMPEG) else 'mock (silence)'}")

warnings = check_config()
if warnings:
    print(f"\nConfig warnings ({len(warnings)}):")
    for w in warnings:
        print(f"  ! {w}")
else:
    print("\nConfig: ALL KEYS PRESENT")
