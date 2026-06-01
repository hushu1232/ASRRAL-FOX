"""
sherpa-onnx Offline TTS Server — AstralFox Desktop Pet Local Speech Synthesis
=============================================================================
Start:  python tts_server.py --port 8767
Build:  pyinstaller --onefile --name tts_server tts_server.py

Endpoints:
  GET  /health      — service health + model status
  POST /synthesize  — {"text": "...", "speaker_id": 0, "speed": 1.0} → audio/wav

Models: vits-melo-zh (Chinese) or vits-zh-aishell3 (fallback)
Format: 16-bit PCM WAV, mono
"""

import argparse
import json
import io
import os
import signal
import struct
import sys
import time
import traceback
import wave
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ── Model paths ─────────────────────────────────────────────────────
MODEL_DIR = Path(os.environ.get("TTS_MODELS_DIR", Path(__file__).resolve().parent / "models"))

# Preferred model (Chinese female voice, mel-spectrogram based)
PREFERRED_MODEL = MODEL_DIR / "vits-melo-tts-zh_en"
ALT_MODEL = MODEL_DIR / "vits-melo-zh"
FALLBACK_MODEL = MODEL_DIR / "vits-zh-aishell3"

# ── Globals ─────────────────────────────────────────────────────────
_tts = None
_tts_loaded = False
_load_error = None
_start_time = time.time()
_sample_rate = 22050


def find_model_dir():
    """Find available TTS model directory."""
    for d in (PREFERRED_MODEL, ALT_MODEL, FALLBACK_MODEL):
        if d.exists() and (d / "model.onnx").exists():
            return d
    return None


def get_tts():
    """Load sherpa-onnx TTS model. Lazy-init on first request."""
    global _tts, _tts_loaded, _load_error, _sample_rate
    if _tts_loaded:
        return _tts
    _tts_loaded = True
    try:
        import sherpa_onnx

        model_dir = find_model_dir()
        if model_dir is None:
            _load_error = (
                "TTS model not found. Please download vits-melo-zh model from: "
                "https://github.com/k2-fsa/sherpa-onnx/releases "
                "and place in models/vits-melo-zh/ with model.onnx, tokens.txt, lexicon.txt"
            )
            print(f"[TTS] {_load_error}", file=sys.stderr, flush=True)
            return None

        model_path = str(model_dir / "model.onnx")
        tokens_path = str(model_dir / "tokens.txt")
        lexicon_path = str(model_dir / "lexicon.txt")

        # Verify all required files exist
        for p, name in [(model_path, "model.onnx"), (tokens_path, "tokens.txt"), (lexicon_path, "lexicon.txt")]:
            if not os.path.exists(p):
                _load_error = f"Missing {name} in {model_dir}"
                print(f"[TTS] {_load_error}", file=sys.stderr, flush=True)
                return None

        print(f"[TTS] Loading model from: {model_dir}", flush=True)

        tts_config = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=model_path,
                    lexicon=lexicon_path,
                    tokens=tokens_path,
                ),
                num_threads=int(os.environ.get("TTS_NUM_THREADS", "2")),
                provider=os.environ.get("TTS_PROVIDER", "cpu"),
            ),
        )

        _tts = sherpa_onnx.OfflineTts(tts_config)
        _sample_rate = getattr(_tts, 'sample_rate', 22050)
        print(f"[TTS] Model loaded. sample_rate={_sample_rate}", flush=True)

    except ImportError:
        _load_error = "sherpa-onnx not installed. Run: pip install sherpa-onnx"
        print(f"[TTS] {_load_error}", file=sys.stderr, flush=True)
    except Exception as e:
        _load_error = str(e)
        print(f"[TTS] Model load failed: {e}", file=sys.stderr, flush=True)
        traceback.print_exc()
    return _tts


# ── HTTP Handler ─────────────────────────────────────────────────────

class TTSHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        if self.server.log_requests:
            print(f"[TTS] {self.client_address[0]} - {fmt % args}", flush=True)

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
            if _tts_loaded and _tts is not None:
                self._send_json(200, {
                    "status": "ok",
                    "sample_rate": _sample_rate,
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
        if self.path == "/synthesize":
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len == 0:
                self._send_json(400, {"error": "empty body"})
                return

            raw = self.rfile.read(content_len)
            try:
                body = json.loads(raw.decode("utf-8"))
                text = body.get("text", "").strip()
                sid = body.get("speaker_id", 0)
                speed = body.get("speed", 1.0)
            except json.JSONDecodeError:
                self._send_json(400, {"error": "invalid JSON"})
                return

            if not text:
                self._send_json(400, {"error": "text is empty"})
                return

            # Clamp parameters
            sid = max(0, min(sid, 9))
            speed = max(0.5, min(speed, 2.0))

            tts = get_tts()
            if tts is None:
                self._send_json(503, {"error": f"TTS model not ready: {_load_error}"})
                return

            try:
                start = time.time()
                audio = tts.generate(text, sid=sid, speed=speed)
                elapsed = time.time() - start

                samples = audio.samples if hasattr(audio, 'samples') else audio
                sample_rate = getattr(audio, 'sample_rate', _sample_rate)

                # Pack as 16-bit PCM WAV
                buf = io.BytesIO()
                with wave.open(buf, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    for s in samples:
                        clipped = max(-1.0, min(1.0, float(s)))
                        wf.writeframes(struct.pack('<h', int(clipped * 32767)))

                wav_bytes = buf.getvalue()
                num_samples = len(list(samples)) if hasattr(samples, '__iter__') else 0

                print(f"[TTS] Synthesized {num_samples} samples ({elapsed:.2f}s) "
                      f"for: {text[:50]}{'...' if len(text) > 50 else ''}", flush=True)

                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", len(wav_bytes))
                self.send_header("X-Sample-Rate", str(sample_rate))
                self.send_header("X-Samples", str(num_samples))
                self.send_header("X-Processing-Time-Ms", str(int(elapsed * 1000)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Expose-Headers",
                                 "X-Sample-Rate, X-Samples, X-Processing-Time-Ms")
                self.end_headers()
                self.wfile.write(wav_bytes)

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
    print(f"\n[TTS] Received signal {signum}, shutting down gracefully...", flush=True)
    if _server:
        _server.shutdown()


# ── Main ─────────────────────────────────────────────────────────────

def main():
    global _server

    parser = argparse.ArgumentParser(description="sherpa-onnx offline TTS server for AstralFox")
    parser.add_argument("--port", type=int, default=8767, help="Listen port (default: 8767)")
    parser.add_argument("--host", default="127.0.0.1", help="Listen host (default: 127.0.0.1)")
    parser.add_argument("--preload", action="store_true", help="Load model immediately on startup")
    parser.add_argument("--log-requests", action="store_true", help="Log HTTP requests to stdout")
    parser.add_argument("--provider", default="cpu", choices=["cpu", "cuda", "coreml"],
                        help="ONNX execution provider")
    args = parser.parse_args()

    if args.provider:
        os.environ.setdefault("TTS_PROVIDER", args.provider)

    print(f"[TTS] Starting server on http://{args.host}:{args.port}", flush=True)
    print(f"[TTS] Model dir: {MODEL_DIR}", flush=True)
    print(f"[TTS] Provider: {os.environ['TTS_PROVIDER']}", flush=True)

    if args.preload:
        print("[TTS] Preloading model at startup...", flush=True)
        get_tts()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    _server = HTTPServer((args.host, args.port), TTSHandler)
    _server.log_requests = args.log_requests

    print(f"[TTS] Ready. Listening on http://{args.host}:{args.port}", flush=True)

    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[TTS] Shutting down.", flush=True)
        _server.server_close()


if __name__ == "__main__":
    main()
