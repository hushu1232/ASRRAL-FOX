"""Offline AI Setup & Validation Script for AstralFox.

Usage:
  python setup_offline_ai.py          # Full check + setup
  python setup_offline_ai.py --check  # Validation only
  python setup_offline_ai.py --json   # Machine-readable output

Checks and optionally sets up:
  1. FunASR (speech recognition) — server .exe + Paraformer model
  2. LLM (Qwen2.5 GGUF) — quantized model for offline chat
  3. TTS (sherpa-onnx / VITS-Melo) — server .exe + voice model
"""
import os
import sys
import json
import hashlib
import argparse

# ─── Paths ───────────────────────────────────────────────────
BASE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
STREAMING = os.path.join(BASE, "AstralFox", "Assets", "StreamingAssets")

CHECKS = {
    "funasr": {
        "label": "FunASR (Speech Recognition)",
        "files": [
            os.path.join(STREAMING, "funasr", "funasr_server.exe"),
        ],
        "model_dir": os.path.join(STREAMING, "funasr", "models"),
        "model_min_files": 3,
        "help": (
            "1. pip install funasr soundfile numpy\n"
            "2. Download Paraformer model → StreamingAssets/funasr/models/\n"
            "3. Run build_exe.bat or: pyinstaller --onefile funasr_server.py"
        ),
    },
    "llm": {
        "label": "LLM (Qwen2.5 GGUF)",
        "files": [
            os.path.join(STREAMING, "models", "llm", "qwen2.5-1.5b-instruct-q4_k_m.gguf"),
        ],
        "help": (
            "Download from HuggingFace:\n"
            "  https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF\n"
            "  → qwen2.5-1.5b-instruct-q4_k_m.gguf\n"
            "Place in: StreamingAssets/models/llm/"
        ),
    },
    "tts": {
        "label": "TTS (sherpa-onnx / VITS-Melo)",
        "files": [
            os.path.join(STREAMING, "tts", "tts_server.exe"),
        ],
        "model_dir": os.path.join(STREAMING, "tts", "models", "vits-melo-tts-zh_en"),
        "model_min_files": 3,
        "help": (
            "1. pip install sherpa-onnx\n"
            "2. Download VITS-Melo-ZH model → StreamingAssets/tts/models/\n"
            "3. Run build_exe.bat or: pyinstaller --onefile tts_server.py"
        ),
    },
    "gpt-sovits": {
        "label": "GPT-SoVITS (Custom Voice TTS)",
        "files": [
            os.path.join(BASE, "gpt-sovits-service", "Dockerfile"),
            os.path.join(BASE, "gpt-sovits-service", "app", "main.py"),
        ],
        "env_check": {"GPT_SOVITS_URL": "http://localhost:9880"},
        "health_url": "http://localhost:9880/docs",
        "help": (
            "1. cd gpt-sovits-service\n"
            "2. docker build -t gpt-sovits . && docker run -d -p 9880:9880 --gpus all gpt-sovits\n"
            "3. Verify: curl http://localhost:9880/docs\n"
            "Used as premium TTS engine in TTSService.cs (see DEPLOYMENT.md)"
        ),
    },
}


def file_hash(path):
    """Quick SHA256 of first 64KB for sanity check."""
    try:
        with open(path, "rb") as f:
            return hashlib.sha256(f.read(65536)).hexdigest()[:12]
    except OSError:
        return None


def check_component(name, cfg):
    """Check a single component. Returns dict with status."""
    result = {"name": name, "label": cfg["label"], "status": "ok", "missing": [], "details": []}

    # Check required files
    for f in cfg.get("files", []):
        if os.path.isfile(f):
            size_mb = os.path.getsize(f) / (1024 * 1024)
            result["details"].append(f"  [OK] {os.path.basename(f)} ({size_mb:.1f} MB)")
        else:
            result["missing"].append(f)
            result["details"].append(f"  [--] {os.path.basename(f)} — MISSING")

    # Check model directory
    model_dir = cfg.get("model_dir")
    if model_dir:
        if os.path.isdir(model_dir):
            file_count = sum(1 for _ in os.walk(model_dir) for __ in _[2])
            min_files = cfg.get("model_min_files", 1)
            if file_count >= min_files:
                result["details"].append(f"  [OK] Model dir: {file_count} files")
            else:
                result["missing"].append(f"{model_dir} (only {file_count} files, need {min_files}+)")
                result["details"].append(f"  [WARN] Model dir: {file_count} files (need {min_files}+)")
        else:
            result["missing"].append(model_dir)
            result["details"].append(f"  [--] Model dir: MISSING — {model_dir}")

    # Check health URL if configured
    health_url = cfg.get("health_url")
    if health_url:
        try:
            import urllib.request
            req = urllib.request.urlopen(health_url, timeout=3)
            result["details"].append(f"  [OK] Health endpoint: {health_url} (HTTP {req.status})")
        except Exception as e:
            result["details"].append(f"  [--] Health endpoint unreachable: {health_url}")
            if not result["missing"]:  # Don't fail if container just isn't running
                pass

    # Check env vars
    env_check = cfg.get("env_check", {})
    for var, default in env_check.items():
        val = os.environ.get(var, "")
        if val:
            result["details"].append(f"  [OK] ENV {var}={val}")
        else:
            result["details"].append(f"  [INFO] ENV {var} not set (default: {default})")

    if result["missing"]:
        result["status"] = "incomplete"
    return result


def run_checks():
    """Run all component checks. Returns list of results."""
    results = []
    for name, cfg in CHECKS.items():
        results.append(check_component(name, cfg))
    return results


def print_report(results, json_mode=False):
    """Print a formatted report."""
    if json_mode:
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    all_ok = all(r["status"] == "ok" for r in results)

    print("=" * 60)
    print("  AstralFox Offline AI — Setup & Validation Report")
    print("=" * 60)

    for r in results:
        icon = "[OK]" if r["status"] == "ok" else "[MISS]"
        print(f"\n{icon} {r['label']}")
        for d in r["details"]:
            print(d)
        if r["missing"] and not json_mode:
            print(f"  Fix:")
            cfg = CHECKS[r["name"]]
            for line in cfg.get("help", "").split("\n"):
                print(f"    {line}")

    print(f"\n{'=' * 60}")
    if all_ok:
        print("  [OK] All offline AI components ready!")
    else:
        incomplete = [r["label"] for r in results if r["status"] != "ok"]
        print(f"  [WARN] {len(incomplete)} component(s) need setup: {', '.join(incomplete)}")
    print("=" * 60)

    return all_ok


def main():
    parser = argparse.ArgumentParser(description="AstralFox Offline AI Setup")
    parser.add_argument("--check", action="store_true", help="Validation only, no downloads")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    args = parser.parse_args()

    print(f"Scanning: {STREAMING}\n")
    results = run_checks()
    all_ok = print_report(results, json_mode=args.json)

    if args.check:
        pass  # Validation only
    elif not all_ok:
        print("\n💡 To set up missing components, follow the instructions above.")
        print("   Or re-run: python setup_offline_ai.py")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
