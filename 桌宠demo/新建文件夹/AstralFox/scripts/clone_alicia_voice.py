#!/usr/bin/env python3
"""
Alicia (艾莉西亚) Voice Cloning Script for AstralFox Desktop Pet.

Generates emotional voice snippets using GPT-SoVITS API with a reference
Alicia audio sample. Outputs WAV files to Unity Resources/Sounds/ for the
SoundEffectManager to load.

Prerequisites:
    pip install requests
    GPT-SoVITS API running on http://127.0.0.1:9880 (or sovits_url from config)

Usage:
    python scripts/clone_alicia_voice.py --ref-audio alicia_sample.wav --ref-text "Alicia reference text"
    python scripts/clone_alicia_voice.py --help
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import requests

# ─── Configuration ────────────────────────────────────────────
DEFAULT_SOVITS_URL = "http://127.0.0.1:9880"
DEFAULT_CHARACTER_NAME = "Alicia"  # 艾莉西亚
DEFAULT_REF_TEXT = "Alicia is a warm and gentle fox spirit companion."

# Voice line definitions — what Alicia says for each emotion
EMOTION_LINES = {
    "VoiceHappy": {
        "zh": "主人回来啦！小星好开心～今天也要一起玩哦！",
        "en": "Master is back! Alicia is so happy~ Let's play together today!",
        "context": "Cheerful and excited greeting",
        "target_pitch": 1.10,
    },
    "VoiceSad": {
        "zh": "主人要走了吗…小星会想你的…",
        "en": "Is master leaving... Alicia will miss you...",
        "context": "Soft and melancholy",
        "target_pitch": 0.90,
    },
    "VoiceShy": {
        "zh": "诶嘿～被主人摸头了…有点害羞呢…",
        "en": "Ehehe~ Master patted my head... I'm a bit shy...",
        "context": "Embarrassed and soft-spoken",
        "target_pitch": 0.95,
    },
    "VoiceAngry": {
        "zh": "哼！不许欺负小星！再这样小星要生气了！",
        "en": "Hmph! Don't bully Alicia! I'm getting angry now!",
        "context": "Pouting and assertive",
        "target_pitch": 1.05,
    },
    "VoiceCurious": {
        "zh": "咦？那是什么？好有趣的样子～小星想去看看！",
        "en": "Huh? What's that? Looks interesting~ Alicia wants to check it out!",
        "context": "Inquisitive and alert",
        "target_pitch": 1.00,
    },
}

# SFX sound generation (using GPT-SoVITS or simple tones)
SFX_LINES = {
    "PatHead": {"zh": "嗯～", "en": "Mmm~", "duration": 0.6},
    "WakeUp": {"zh": "主人！早上好～新的一天开始了！", "en": "Master! Good morning~ A new day begins!", "duration": 1.5},
    "Sleep": {"zh": "晚安…", "en": "Good night...", "duration": 1.0},
    "Feed": {"zh": "好好吃！谢谢主人～", "en": "So yummy! Thank you master~", "duration": 1.2},
}


def sovits_api(base_url: str, reference_audio_b64: str, reference_text: str,
               target_text: str, target_lang: str = "zh") -> Optional[bytes]:
    """Call GPT-SoVITS API and return WAV audio bytes."""
    payload = {
        "data": [
            {"name": "audio.wav", "data": f"data:audio/wav;base64,{reference_audio_b64}"},
            reference_text,
            "zh",          # reference language
            target_text,
            target_lang,   # target language
            "按标点切分",  # split by punctuation
            5,             # top_k
            1.0,           # top_p
            1.0,           # temperature
            False,         # text reference mode
        ]
    }

    try:
        resp = requests.post(f"{base_url}/tts", json=payload, timeout=30)
        if resp.status_code != 200:
            print(f"  ⚠️ API error {resp.status_code}: {resp.text[:200]}")
            return None

        data = resp.json()
        if not data.get("data"):
            return None

        wav_path = data["data"][0].get("name", "")
        if not wav_path:
            return None

        # Fetch the generated WAV file
        wav_resp = requests.get(f"file://{wav_path}" if wav_path.startswith("/") else wav_path, timeout=10)
        if wav_resp.status_code == 200:
            return wav_resp.content

        # Alternative: try HTTP GET from server
        wav_url = f"{base_url.rstrip('/')}/file/{os.path.basename(wav_path)}"
        wav_resp = requests.get(wav_url, timeout=10)
        if wav_resp.status_code == 200:
            return wav_resp.content

        print(f"  ⚠️ Could not fetch generated WAV from {wav_path}")
        return None

    except requests.exceptions.ConnectionError:
        print(f"  ❌ Cannot connect to GPT-SoVITS at {base_url}")
        return None
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None


def load_reference_audio(ref_path: str) -> Tuple[str, bytes]:
    """Load reference audio file and return (base64_string, raw_bytes)."""
    with open(ref_path, "rb") as f:
        raw = f.read()
    b64 = base64.b64encode(raw).decode("utf-8")
    return b64, raw


def generate_sine_tone(frequency: float, duration: float, sample_rate: int = 22050) -> bytes:
    """Generate a simple sine wave WAV file (fallback for SFX)."""
    import struct

    num_samples = int(sample_rate * duration)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        envelope = max(0, 1 - t / duration) * 2  # linear decay
        sample = int(32767 * 0.3 * envelope * (1 if frequency == 0 else
                      (__import__("math").sin(2 * __import__("math").pi * frequency * t))))
        samples.append(sample)

    # WAV header
    data_size = num_samples * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size,
        b"WAVE", b"fmt ", 16, 1, 1, sample_rate,
        sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    data = struct.pack(f"<{num_samples}h", *samples)
    return header + data


def generate_sfx_fallback(output_dir: Path) -> int:
    """Generate simple tone WAVs for non-voice SFX events."""
    sfx_templates = {
        "PatHead": (440, 0.15),
        "DragStart": (300, 0.1),
        "DragEnd": (400, 0.08),
        "Bounce": (300, 0.1),
        "Land": (200, 0.08),
        "Notification": (880, 0.15),
        "Reminder": (1000, 0.2),
    }

    count = 0
    for name, (freq, dur) in sfx_templates.items():
        path = output_dir / f"{name}.wav"
        if path.exists():
            continue
        wav = generate_sine_tone(freq, dur)
        path.write_bytes(wav)
        print(f"  ✓ Generate SFX: {name}.wav ({freq}Hz, {dur}s)")
        count += 1

    return count


def main():
    parser = argparse.ArgumentParser(description="Clone Alicia voice for AstralFox desktop pet")
    parser.add_argument("--ref-audio", required=True, help="Path to Alicia reference audio WAV (16kHz mono)")
    parser.add_argument("--ref-text", default=DEFAULT_REF_TEXT, help="Text matching the reference audio")
    parser.add_argument("--sovits-url", default=DEFAULT_SOVITS_URL, help="GPT-SoVITS API base URL")
    parser.add_argument("--output-dir", default=None, help="Output directory for generated WAVs")
    parser.add_argument("--lang", default="zh", choices=["zh", "en", "ja"], help="Target language for voice lines")
    parser.add_argument("--dry-run", action="store_true", help="Print voice lines without generating audio")
    parser.add_argument("--skip-existing", action="store_true", help="Skip files that already exist")

    args = parser.parse_args()

    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = Path(__file__).parent.parent / "Assets" / "Resources" / "Sounds"
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"🎤 Alicia Voice Cloning for AstralFox")
    print(f"   Reference: {args.ref_audio}")
    print(f"   Output: {output_dir}")
    print(f"   API: {args.sovits_url}")
    print()

    # Load reference audio
    print("📂 Loading reference audio...")
    try:
        ref_b64, ref_raw = load_reference_audio(args.ref_audio)
        print(f"   ✓ Loaded {len(ref_raw)} bytes ({len(ref_raw)/16000:.1f}s @ 16kHz)")
    except Exception as e:
        print(f"   ❌ Failed to load: {e}")
        sys.exit(1)

    if args.dry_run:
        print("\n📝 Voice lines (dry run):")
        for name, lines in EMOTION_LINES.items():
            print(f"   {name}: \"{lines[args.lang]}\"")
        print()
        for name, lines in SFX_LINES.items():
            print(f"   {name}: \"{lines[args.lang]}\"")
        return

    # Generate voice snippets via GPT-SoVITS
    print("\n🎙️ Generating voice snippets via GPT-SoVITS...")
    voice_count = 0

    for name, lines in EMOTION_LINES.items():
        out_path = output_dir / f"{name}.wav"
        if args.skip_existing and out_path.exists():
            print(f"   ⏭️ {name}.wav (exists, skipping)")
            voice_count += 1
            continue

        text = lines.get(args.lang, lines["zh"])
        print(f"   🔊 {name}: \"{text}\"", end="", flush=True)

        wav = sovits_api(args.sovits_url, ref_b64, args.ref_text, text, args.lang)
        if wav:
            out_path.write_bytes(wav)
            print(f" → ✓ {len(wav)} bytes")
            voice_count += 1
        else:
            print(f" → ❌ FAILED")
            # Fallback to sine tone so the slot is never empty
            duration = len(text) * 0.15  # rough estimate
            tone = generate_sine_tone(
                {"VoiceHappy": 440, "VoiceSad": 330, "VoiceShy": 370,
                 "VoiceAngry": 520, "VoiceCurious": 494}[name],
                duration,
            )
            out_path.write_bytes(tone)
            print(f"   ⚠️ Fallback tone saved for {name}.wav")

        time.sleep(0.3)

    # Generate SFX voice snippets
    print("\n🎵 Generating SFX voice snippets...")
    sfx_count = 0
    for name, lines in SFX_LINES.items():
        out_path = output_dir / f"{name}.wav"
        if args.skip_existing and out_path.exists():
            print(f"   ⏭️ {name}.wav (exists, skipping)")
            sfx_count += 1
            continue

        text = lines.get(args.lang, lines["zh"])
        print(f"   🔊 {name}: \"{text}\"", end="", flush=True)

        wav = sovits_api(args.sovits_url, ref_b64, args.ref_text, text, args.lang)
        if wav:
            out_path.write_bytes(wav)
            print(f" → ✓ {len(wav)} bytes")
            sfx_count += 1
        else:
            # Fallback tone
            tone = generate_sine_tone(
                {"PatHead": 440, "WakeUp": 660, "Sleep": 330, "Feed": 500}[name],
                lines["duration"],
            )
            out_path.write_bytes(tone)
            print(f" → ⚠️ Fallback tone")

        time.sleep(0.3)

    # Generate remaining SFX (non-voice, simple tones)
    print("\n🔧 Generating remaining SFX (simple tones)...")
    remaining = generate_sfx_fallback(output_dir)

    print(f"\n✅ Done! Voice: {voice_count}, SFX: {sfx_count}, Tones: {remaining}")
    print(f"   Output: {output_dir}")
    print(f"\n📋 Next: Rebuild Unity project to include Resources/Sounds/ in the build.")
    print(f"   SoundEffectManager will auto-load from Resources/Sounds/[EventName]")


if __name__ == "__main__":
    main()
