"""
Custom voice model listing and management.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import settings

router = APIRouter()


@router.get("/voices")
async def list_voices():
    """List all trained custom voice models."""
    voices_dir = Path(settings.custom_voices_dir)
    if not voices_dir.exists():
        return {"voices": [], "total": 0}

    voices = []
    for entry in sorted(voices_dir.iterdir()):
        if not entry.is_dir() or entry.name == "uploads":
            continue
        gpt_ckpt = entry / "gpt.ckpt"
        sovits_ckpt = entry / "sovits.pth"
        ref_wav = entry / "ref.wav"
        ref_txt = entry / "ref.txt"

        if gpt_ckpt.exists() and sovits_ckpt.exists():
            prompt_text = ref_txt.read_text("utf-8").strip() if ref_txt.exists() else ""
            voices.append({
                "voice_id": entry.name,
                "has_reference_audio": ref_wav.exists(),
                "prompt_text": prompt_text,
                "gpt_model_size_mb": round(gpt_ckpt.stat().st_size / (1024 * 1024), 1),
                "sovits_model_size_mb": round(sovits_ckpt.stat().st_size / (1024 * 1024), 1),
            })

    return {"voices": voices, "total": len(voices)}


@router.delete("/voices/{voice_id}")
async def delete_voice(voice_id: str):
    """Delete a custom voice model."""
    voice_dir = Path(settings.custom_voices_dir) / voice_id
    if not voice_dir.exists():
        raise HTTPException(404, f"Voice '{voice_id}' not found.")

    import shutil
    shutil.rmtree(voice_dir)
    return {"deleted": True, "voice_id": voice_id}
