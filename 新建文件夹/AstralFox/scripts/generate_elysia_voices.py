"""
Elysia Voice Generator for AstralFox — ONE-CLICK batch generation.

Prerequisites:
  1. GPT-SoVITS WebUI running (python webui.py in GPT-SoVITS directory)
  2. Elysia model loaded in WebUI (GPT_weights + SoVITS_weights from D:\lobotomy\)
  3. Python packages: pip install requests

Usage:
  python scripts/generate_elysia_voices.py
  python scripts/generate_elysia_voices.py --api http://127.0.0.1:9880 --dry-run

Output: Assets/Resources/Sounds/Elysia/*.wav (16 files)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# ─── Paths ─────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "Assets" / "Resources" / "Sounds" / "Elysia"
ELYSIA_DIR = Path(r"D:\lobotomy\爱莉希雅\【GPT-SoVITS】爱莉希雅V2")
REF_DIR = ELYSIA_DIR / "参考音频"

# ─── Emotion → Reference Audio ─────────────────────────────────
REFERENCE_MAP = {
    "Happy": {
        "file": "【开心】哎呀这是在夸我吗？欸嘿，那再多夸几句也没关系啊。.wav",
        "text": "哎呀这是在夸我吗？欸嘿，那再多夸几句也没关系啊。",
    },
    "Touched": {
        "file": "【感动】悲剧并非终结，而是希望的起始。.wav",
        "text": "悲剧并非终结，而是希望的起始。",
    },
    "Embarrassed": {
        "file": "【尴尬】呃，芽衣，你的问题还真是一如既往的，刁钻。.wav",
        "text": "呃，芽衣，你的问题还真是一如既往的，刁钻。",
    },
    "Serious": {
        "file": "【严肃】还不错哦，保持现状继续前进吧。.wav",
        "text": "还不错哦，保持现状继续前进吧。",
    },
    "Surprised": {
        "file": "【惊喜】哇，那不是预约不知排到什么时候的超级餐厅嘛，突然带个人会不会给你添麻烦呀？.wav",
        "text": "哇，那不是预约不知排到什么时候的超级餐厅嘛，突然带个人会不会给你添麻烦呀？",
    },
}

# ─── Voice Lines ────────────────────────────────────────────────
# Format: {filename_without_ext: (emotion_key, target_text, description)}
VOICE_SCRIPTS = [
    # Voice Emotions (primary)
    ("VoiceHappy",    "Happy",     "主人，欢迎回来！今天也是元气满满的一天呢～"),
    ("VoiceSad",      "Touched",   "主人…你要走了吗？但没关系，我们留下的足迹，终会成为另一个人的灯火"),
    ("VoiceShy",      "Embarrassed","诶嘿～被主人夸了呢…这、这不过是少女的小心思罢了～"),
    ("VoiceAngry",    "Serious",   "哼！这样可不行呢。还不错，保持现状继续前进吧！"),
    ("VoiceCurious",  "Surprised", "哇！那是什么？主人，我们过去看看吧？"),

    # Interaction Voice
    ("WakeUp",        "Happy",     "早安呀，主人～今天的你，比昨天更好看了呢"),
    ("Sleep",         "Touched",   "晚安，主人。愿你的梦境如烟花般绚烂"),
    ("PatHead",       "Happy",     "嗯～好舒服呢。欸嘿，再摸一下嘛？"),
    ("Feed",          "Surprised", "哇！这、这是专门为我准备的吗？好开心～"),

    # UI
    ("Notification",  "Happy",     "主人～有新的消息哦，快去看看吧"),
    ("Reminder",      "Serious",   "主人，别忘了重要的事情。我会一直在这里等你的"),
]

# ─── SFX (synthesized tones, no voice cloning needed) ──────────
SFX_FILES = ["DragStart", "DragEnd", "Bounce", "Land"]


def call_tts_v2(api_url: str, ref_path: str, ref_text: str,
                target_text: str, target_lang: str = "zh") -> Optional[bytes]:
    """
    Call GPT-SoVITS api_v2 /tts endpoint.
    Returns WAV bytes on success, None on failure.
    """
    payload = {
        "text": target_text,
        "text_lang": target_lang,
        "ref_audio_path": ref_path,
        "prompt_text": ref_text,
        "prompt_lang": "zh",
        "text_split_method": "cut5",
        "top_k": 5,
        "top_p": 1.0,
        "temperature": 1.0,
        "batch_size": 1,
        "media_type": "wav",
    }

    try:
        resp = requests.post(f"{api_url}/tts", json=payload, timeout=120)
        if resp.status_code == 200:
            return resp.content  # API returns WAV bytes directly
        else:
            detail = resp.json().get("message", resp.text[:200])
            print(f"    ⚠ API error {resp.status_code}: {detail}")
            return None

    except requests.exceptions.ConnectionError:
        print(f"    ❌ Cannot connect to {api_url}/tts")
        return None
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return None


def generate_sine_wav(freq: float, duration: float, sr: int = 22050) -> bytes:
    """Generate a simple sine wave WAV (fallback for SFX)."""
    import math, struct
    n = int(sr * duration)
    samples = []
    for i in range(n):
        t = i / sr
        env = max(0, 1 - t / duration) * 2
        s = int(32767 * 0.25 * env * math.sin(2 * math.pi * freq * t))
        samples.append(s)
    data_size = n * 2
    header = struct.pack("<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16, 1, 1, sr,
        sr * 2, 2, 16, b"data", data_size)
    return header + struct.pack(f"<{n}h", *samples)


def main():
    parser = argparse.ArgumentParser(description="Generate Elysia voice clips for AstralFox")
    parser.add_argument("--api", default="http://127.0.0.1:9880",
                        help="GPT-SoVITS API base URL (default: http://127.0.0.1:9880)")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="Output directory for WAV files")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without generating")
    parser.add_argument("--skip-existing", action="store_true", help="Skip files that already exist")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Reference audio paths are verified and used directly (no cache needed for api_v2)
    print("=" * 70)
    print("  🎤 Elysia Voice Generator — AstralFox Desktop Pet")
    print("=" * 70)
    print(f"  API: {args.api}")
    print(f"  Output: {output_dir}")
    print(f"  Reference dir: {REF_DIR}")
    print()

    if args.dry_run:
        print("📝 DRY RUN — Printing voice scripts:")
        for name, emotion, text in VOICE_SCRIPTS:
            print(f"  ▶ {name}: [{emotion}] \"{text}\"")
        print(f"\n  Total: {len(VOICE_SCRIPTS)} voice clips + {len(SFX_FILES)} SFX")
        return

    # Step 1: Check API
    print("1️⃣  Checking GPT-SoVITS API...", end=" ", flush=True)
    try:
        r = requests.get(f"{args.api}/docs", timeout=5)
        if r.status_code == 200:
            print("✅ ONLINE")
        else:
            print(f"⚠️  Unexpected status {r.status_code}")
    except Exception:
        print("❌ OFFLINE")
        print("\n   Please start GPT-SoVITS API first:")
        print(f"   cd D:\\GPT-SoVITS && .venv\\Scripts\\python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer_elysia.yaml")
        print("\n   Then re-run this script.")
        sys.exit(1)

    # Step 2: Verify reference audio files exist
    print("2️⃣  Verifying reference audio...")
    for emo, info in REFERENCE_MAP.items():
        path = REF_DIR / info["file"]
        if not path.exists():
            print(f"   ❌ Missing: {path}")
            sys.exit(1)
        print(f"   ✓ {emo}: {info['file']}")

    # Step 3: Generate voice clips
    print(f"\n3️⃣  Generating {len(VOICE_SCRIPTS)} voice clips...\n")
    success = 0
    failed = 0

    for name, emotion, text in VOICE_SCRIPTS:
        out_path = output_dir / f"{name}.wav"

        if args.skip_existing and out_path.exists():
            print(f"   ⏭️  {name}.wav (exists)")
            success += 1
            continue

        ref_path = str(REF_DIR / REFERENCE_MAP[emotion]["file"])
        ref_text = REFERENCE_MAP[emotion]["text"]

        print(f"   🔊 {name}: \"{text[:40]}...\"", end="", flush=True)
        wav_data = call_tts_v2(args.api, ref_path, ref_text, text)

        if wav_data:
            out_path.write_bytes(wav_data)
            print(f" → ✓ {len(wav_data)}B")
            success += 1
        else:
            print(f" → ❌ TTS failed")
            failed += 1

        time.sleep(0.3)

    # Step 4: Generate SFX files
    print(f"\n4️⃣  Generating {len(SFX_FILES)} SFX files...\n")
    sfx_map = {
        "DragStart": (300, 0.10),
        "DragEnd":   (400, 0.08),
        "Bounce":    (300, 0.10),
        "Land":      (200, 0.08),
    }
    for name in SFX_FILES:
        out_path = output_dir / f"{name}.wav"
        if args.skip_existing and out_path.exists():
            print(f"   ⏭️  {name}.wav (exists)")
            continue
        freq, dur = sfx_map.get(name, (400, 0.1))
        wav = generate_sine_wav(freq, dur)
        out_path.write_bytes(wav)
        print(f"   ✓ {name}.wav ({freq}Hz, {dur}s)")

    # Done
    print(f"\n{'=' * 70}")
    print(f"  ✅ Complete!  Voice: {success} success, {failed} failed")
    print(f"  📁 {output_dir}")
    print(f"{'=' * 70}")
    print(f"\n  Next: Build Unity project. SoundEffectManager loads from")
    print(f"  Resources/Sounds/Elysia/[SoundEvent].wav automatically.")


if __name__ == "__main__":
    main()
