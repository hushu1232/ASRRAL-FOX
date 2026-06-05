"""
Text-to-speech synthesis endpoint.
"""

import time
import io
import struct
import wave
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings

router = APIRouter()

# Lazy-loaded GPT-SoVITS inference pipeline
_inference = None


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize")
    voice_id: str | None = Field(None, description="Custom voice ID (uses default voice if omitted)")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="Speaking speed factor")
    top_k: int = Field(5, ge=1, le=20)
    top_p: float = Field(1.0, ge=0.0, le=1.0)
    temperature: float = Field(1.0, ge=0.1, le=2.0)


def _get_inference():
    """Lazy-init the GPT-SoVITS inference pipeline."""
    global _inference
    if _inference is not None:
        return _inference

    import sys
    sys.path.insert(0, settings.gpt_sovits_path)

    try:
        from tools.my_utils import load_audio
        from infer_web import get_tts_wav

        _inference = {"load_audio": load_audio, "get_tts_wav": get_tts_wav}
        print("[GPT-SoVITS] Inference pipeline loaded")
        return _inference
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"GPT-SoVITS not installed. Error: {e}"
        )


def _find_voice_model(voice_id: str | None):
    """Resolve voice model paths. Falls back to default pretrained."""
    if voice_id:
        voice_dir = Path(settings.custom_voices_dir) / voice_id
        if voice_dir.exists():
            gpt_ckpt = voice_dir / "gpt.ckpt"
            sovits_ckpt = voice_dir / "sovits.pth"
            ref_audio = voice_dir / "ref.wav"
            ref_text = (voice_dir / "ref.txt").read_text("utf-8").strip()
            if gpt_ckpt.exists() and sovits_ckpt.exists() and ref_audio.exists():
                return {
                    "gpt_model": str(gpt_ckpt),
                    "sovits_model": str(sovits_ckpt),
                    "ref_audio": str(ref_audio),
                    "prompt_text": ref_text or settings.default_prompt_text,
                    "prompt_lang": settings.default_prompt_lang,
                }

    # Default pretrained model
    return {
        "gpt_model": str(Path(settings.pretrained_models_dir) / settings.default_gpt_model),
        "sovits_model": str(Path(settings.pretrained_models_dir) / settings.default_sovits_model),
        "ref_audio": settings.default_ref_audio,
        "prompt_text": settings.default_prompt_text,
        "prompt_lang": settings.default_prompt_lang,
    }


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """
    Synthesize speech from text using a custom or default voice.
    Returns WAV audio bytes.
    """
    model = _find_voice_model(req.voice_id)

    # Validate model files exist
    for key in ("gpt_model", "sovits_model"):
        if not Path(model[key]).exists():
            raise HTTPException(
                status_code=404,
                detail=f"Model file not found: {model[key]}"
            )

    try:
        infer = _get_inference()
        start = time.time()

        result = infer["get_tts_wav"](
            model,
            req.text,
            req.text,
            speed=req.speed,
            top_k=req.top_k,
            top_p=req.top_p,
            temperature=req.temperature,
        )

        sample_rate, audio = result
        elapsed = time.time() - start

        # Convert audio samples to 16-bit PCM WAV
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            for s in audio:
                clipped = max(-1.0, min(1.0, float(s)))
                wf.writeframes(struct.pack('<h', int(clipped * 32767)))

        wav_bytes = buf.getvalue()
        num_samples = len(audio)

        print(f"[GPT-SoVITS] Synthesized {num_samples} samples ({elapsed:.2f}s) "
              f"for: {req.text[:50]}{'...' if len(req.text) > 50 else ''}")

        from fastapi.responses import Response
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(sample_rate),
                "X-Samples": str(num_samples),
                "X-Processing-Time-Ms": str(int(elapsed * 1000)),
                "X-Voice-Id": req.voice_id or "default",
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {e}")
