"""
FunASR Offline Speech Recognition Server — AstralFox Desktop Pet Local ASR Engine
=============================================================================
Start:  python funasr_server.py --port 8766 --model paraformer-large
Build:  pyinstaller --onefile --name funasr_server funasr_server.py

Endpoints:
  GET  /health      — service health + model status
  POST /recognize   — send audio/wav, receive {"text": "..."}

Audio format: 16kHz, 16-bit, mono WAV or raw PCM16
"""

import argparse
import json
import os
import signal
import sys
import time
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ── Model paths ─────────────────────────────────────────────────────
MODEL_DIR = Path(os.environ.get("FUNASR_MODELS_DIR", Path(__file__).resolve().parent / "models"))
PARAFORMER_MODEL = "iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
DEFAULT_MODEL_DIR = MODEL_DIR / "paraformer-large"
LOCAL_MODEL_DIR = MODEL_DIR / "paraformer-large-local"  # manual download fallback

# ── Globals (lazy-loaded) ────────────────────────────────────────────
_model = None
_model_loaded = False
_load_error = None
_start_time = time.time()


def find_model_path():
    """Find the best available model: local export > modelscope cache > auto-download."""
    if DEFAULT_MODEL_DIR.exists():
        return str(DEFAULT_MODEL_DIR)
    if LOCAL_MODEL_DIR.exists():
        return str(LOCAL_MODEL_DIR)
    # Check modelscope cache
    import modelscope
    try:
        from modelscope.hub.snapshot_download import snapshot_download
        cache_dir = os.environ.get("MODELSCOPE_CACHE", os.path.join(Path.home(), ".cache", "modelscope", "hub"))
        model_cache = Path(cache_dir) / "iic" / "speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
        if model_cache.exists():
            return str(model_cache)
    except ImportError:
        pass
    # Will trigger auto-download from modelscope
    return PARAFORMER_MODEL


def get_model():
    """Load FunASR Paraformer model. Lazy-init on first request."""
    global _model, _model_loaded, _load_error
    if _model_loaded:
        return _model
    _model_loaded = True
    try:
        from funasr import AutoModel

        model_path = find_model_path()
        print(f"[FunASR] Loading model: {model_path}", flush=True)

        _model = AutoModel(
            model=model_path,
            disable_update=True,
            device=os.environ.get("FUNASR_DEVICE", "cpu"),
            ncpu=int(os.environ.get("FUNASR_NUM_THREADS", "4")),
        )
        print(f"[FunASR] Model loaded successfully.", flush=True)
    except Exception as e:
        _load_error = str(e)
        print(f"[FunASR] Model load failed: {e}", file=sys.stderr, flush=True)
        traceback.print_exc()
    return _model


# ── HTTP Handler ─────────────────────────────────────────────────────

class ASRHandler(BaseHTTPRequestHandler):

    # Silence default access logs
    def log_message(self, fmt, *args):
        if self.server.log_requests:
            print(f"[FunASR] {self.client_address[0]} - {fmt % args}", flush=True)

    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/health", "/"):
            uptime = time.time() - _start_time
            if _model_loaded and _model is not None:
                self._send_json(200, {
                    "status": "ok",
                    "model": PARAFORMER_MODEL,
                    "device": os.environ.get("FUNASR_DEVICE", "cpu"),
                    "uptime_seconds": round(uptime, 1),
                })
            elif _load_error:
                self._send_json(503, {
                    "status": "error",
                    "error": _load_error,
                    "uptime_seconds": round(uptime, 1),
                })
            else:
                self._send_json(200, {
                    "status": "loading",
                    "message": "Model is loading, retry in a few seconds.",
                })
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/recognize":
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len == 0:
                self._send_json(400, {"error": "empty body"})
                return

            content_type = self.headers.get("Content-Type", "")
            raw = self.rfile.read(content_len)

            model = get_model()
            if model is None:
                self._send_json(503, {"error": f"model not loaded: {_load_error}"})
                return

            try:
                if "multipart" in content_type or content_type.startswith("audio/"):
                    import tempfile
                    import numpy as np

                    is_wav = raw[:4] == b"RIFF"
                    suffix = ".wav" if is_wav else ".pcm"

                    if is_wav:
                        import soundfile as sf
                        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
                        tmp.write(raw)
                        tmp.close()
                        audio, sr = sf.read(tmp.name)
                        Path(tmp.name).unlink(missing_ok=True)
                        if sr != 16000:
                            import scipy.signal
                            target_len = int(len(audio) * 16000 / sr)
                            audio = scipy.signal.resample(audio, target_len)
                        result = model.generate(input=audio, language="zh")
                    else:
                        # Raw PCM16: 16kHz, 16-bit, mono
                        audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                        result = model.generate(input=audio, language="zh")
                else:
                    self._send_json(400, {
                        "error": "unsupported content type",
                        "hint": "Send audio/wav or audio/pcm16 with raw PCM data"
                    })
                    return

                text = result[0].get("text", "") if result else ""
                self._send_json(200, {
                    "text": text.strip(),
                    "status": "ok",
                })

            except Exception as e:
                traceback.print_exc()
                self._send_json(500, {"error": str(e), "status": "error"})
        else:
            self._send_json(404, {"error": "not found"})

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


# ── Graceful Shutdown ─────────────────────────────────────────────────

_server = None


def handle_signal(signum, frame):
    print(f"\n[FunASR] Received signal {signum}, shutting down gracefully...", flush=True)
    if _server:
        _server.shutdown()


# ── Main ─────────────────────────────────────────────────────────────

def main():
    global _server

    parser = argparse.ArgumentParser(description="FunASR local ASR server for AstralFox")
    parser.add_argument("--port", type=int, default=8766, help="Listen port (default: 8766)")
    parser.add_argument("--host", default="127.0.0.1", help="Listen host (default: 127.0.0.1)")
    parser.add_argument("--preload", action="store_true", help="Load model immediately on startup")
    parser.add_argument("--log-requests", action="store_true", help="Log HTTP requests to stdout")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Inference device")
    args = parser.parse_args()

    # Apply environment overrides
    if args.device:
        os.environ.setdefault("FUNASR_DEVICE", args.device)

    print(f"[FunASR] Starting server on http://{args.host}:{args.port}", flush=True)
    print(f"[FunASR] Model dir: {MODEL_DIR}", flush=True)
    print(f"[FunASR] Device: {os.environ['FUNASR_DEVICE']}", flush=True)

    if args.preload:
        print("[FunASR] Preloading model at startup...", flush=True)
        get_model()

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    _server = HTTPServer((args.host, args.port), ASRHandler)
    _server.log_requests = args.log_requests

    print(f"[FunASR] Ready. Listening on http://{args.host}:{args.port}", flush=True)

    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[FunASR] Shutting down.", flush=True)
        _server.server_close()


if __name__ == "__main__":
    main()
