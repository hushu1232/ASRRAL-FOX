"""
Voice cloning / fine-tuning endpoints.
"""

import uuid
import time
import shutil
import subprocess
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from config import settings

router = APIRouter()

# In-memory task store (replace with Redis for production)
_tasks: dict[str, dict] = {}
_task_lock = threading.Lock()


class TrainResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatus(BaseModel):
    task_id: str
    status: str  # "uploading" | "preprocessing" | "training" | "completed" | "failed"
    progress: float  # 0.0 – 100.0
    message: str
    voice_id: str | None = None
    started_at: float
    completed_at: float | None = None
    error: str | None = None


def _run_training_pipeline(task_id: str, audio_path: str, voice_name: str, prompt_text: str):
    """Background training pipeline: preprocess → train GPT → train SoVITS → package."""
    task = _tasks[task_id]

    try:
        # Step 1: Preprocessing (0-25%)
        _update_task(task_id, "preprocessing", 5.0, "Resampling audio to 16kHz mono...")
        output_dir = Path(settings.custom_voices_dir) / task_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # Resample with ffmpeg
        wav_path = output_dir / "ref.wav"
        subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
            str(wav_path)
        ], check=True, capture_output=True)

        # Save prompt text
        (output_dir / "ref.txt").write_text(prompt_text, encoding="utf-8")

        _update_task(task_id, "preprocessing", 20.0, "Preprocessing complete. Starting GPT training...")

        # Step 2: GPT training (25-60%)
        _update_task(task_id, "training", 25.0, "Training GPT model...")
        gpt_script = Path(settings.gpt_sovits_path) / "s1train.py"

        # Build training command
        cmd = [
            "python", str(gpt_script),
            "--epochs", "50",
            "--batch_size", "4",
            "--save_every_epoch", "10",
            "--output_dir", str(output_dir / "gpt"),
        ]
        subprocess.run(cmd, check=True, capture_output=True, cwd=settings.gpt_sovits_path)

        _update_task(task_id, "training", 60.0, "GPT training complete. Starting SoVITS training...")

        # Step 3: SoVITS training (60-90%)
        _update_task(task_id, "training", 60.0, "Training SoVITS model...")
        sovits_script = Path(settings.gpt_sovits_path) / "s2train.py"

        cmd = [
            "python", str(sovits_script),
            "--epochs", "20",
            "--batch_size", "4",
            "--output_dir", str(output_dir / "sovits"),
        ]
        subprocess.run(cmd, check=True, capture_output=True, cwd=settings.gpt_sovits_path)

        _update_task(task_id, "training", 90.0, "Training complete. Packaging model...")

        # Step 4: Package final model (90-100%)
        _update_task(task_id, "packaging", 95.0, "Copying best checkpoints...")
        _package_best_checkpoints(output_dir)

        _update_task(task_id, "completed", 100.0, f"Voice '{voice_name}' is ready!")

    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        _update_task(task_id, "failed", task["progress"], f"Training failed: {error_msg}",
                     error=error_msg)
    except Exception as e:
        _update_task(task_id, "failed", task["progress"], f"Training failed: {e}",
                     error=str(e))


def _package_best_checkpoints(output_dir: Path):
    """Copy best GPT and SoVITS checkpoints to the voice directory root."""
    gpt_dir = output_dir / "gpt"
    sovits_dir = output_dir / "sovits"

    # Find latest GPT checkpoint
    gpt_ckpts = sorted(gpt_dir.glob("s1*.ckpt"))
    if gpt_ckpts:
        shutil.copy2(gpt_ckpts[-1], output_dir / "gpt.ckpt")

    # Find latest SoVITS checkpoint
    sovits_ckpts = sorted(sovits_dir.glob("s2*.pth"))
    if sovits_ckpts:
        shutil.copy2(sovits_ckpts[-1], output_dir / "sovits.pth")


def _update_task(task_id: str, status: str, progress: float, message: str,
                 *, voice_id: str | None = None, error: str | None = None):
    with _task_lock:
        t = _tasks[task_id]
        t["status"] = status
        t["progress"] = progress
        t["message"] = message
        if voice_id:
            t["voice_id"] = voice_id
        if error:
            t["error"] = error
        if status in ("completed", "failed"):
            t["completed_at"] = time.time()


@router.post("/train", response_model=TrainResponse)
async def start_training(
    audio: UploadFile = File(..., description="Reference audio (1-5 min, no background noise)"),
    voice_name: str = Form(..., min_length=1, max_length=50, description="Name for this voice"),
    prompt_text: str = Form("", description="Transcript of the reference audio (optional)"),
):
    """
    Start a voice cloning training task.
    Upload 1-5 minutes of high-quality dry vocal audio.
    Returns a task_id for polling progress.
    """
    # Validate file type
    if audio.content_type not in ("audio/wav", "audio/mpeg", "audio/mp3",
                                   "audio/ogg", "audio/flac", "audio/x-wav"):
        raise HTTPException(400, "Unsupported audio format. Use WAV, MP3, OGG, or FLAC.")

    # Save uploaded file
    task_id = str(uuid.uuid4())
    upload_dir = Path(settings.custom_voices_dir) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(audio.filename).suffix or ".wav"
    upload_path = upload_dir / f"{task_id}{ext}"
    content = await audio.read()

    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {settings.max_upload_size_mb}MB.")

    upload_path.write_bytes(content)

    # Validate duration with ffprobe
    try:
        result = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
            str(upload_path)
        ], check=True, capture_output=True, text=True)
        duration = float(result.stdout.strip())
        if duration < settings.min_audio_duration_seconds:
            upload_path.unlink()
            raise HTTPException(400, f"Audio too short ({duration:.1f}s). "
                                      f"Minimum {settings.min_audio_duration_seconds}s required.")
        if duration > settings.max_audio_duration_seconds:
            upload_path.unlink()
            raise HTTPException(400, f"Audio too long ({duration:.1f}s). "
                                      f"Maximum {settings.max_audio_duration_seconds}s (5 min) allowed.")
    except subprocess.CalledProcessError:
        upload_path.unlink()
        raise HTTPException(400, "Could not read audio duration. Ensure the file is valid audio.")

    # Register task
    with _task_lock:
        _tasks[task_id] = {
            "task_id": task_id,
            "status": "uploading",
            "progress": 0.0,
            "message": "Audio uploaded. Starting preprocessing...",
            "voice_name": voice_name,
            "started_at": time.time(),
            "completed_at": None,
            "error": None,
            "voice_id": None,
        }

    # Start training in background thread
    thread = threading.Thread(
        target=_run_training_pipeline,
        args=(task_id, str(upload_path), voice_name, prompt_text),
        daemon=True,
    )
    thread.start()

    return TrainResponse(
        task_id=task_id,
        status="started",
        message=f"Training started for voice '{voice_name}'. Poll /api/train/{task_id}/status for progress.",
    )


@router.get("/train/{task_id}/status", response_model=TaskStatus)
async def get_training_status(task_id: str):
    """Get training progress for a voice cloning task."""
    with _task_lock:
        task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, f"Task {task_id} not found.")
    return TaskStatus(**task)
