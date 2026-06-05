"""
GPT-SoVITS Service — FastAPI entry point.

Endpoints:
  GET  /health              — service health + model status
  POST /synthesize          — text-to-speech with custom voice
  POST /train               — start voice cloning task
  GET  /train/{task_id}/status — training progress
  GET  /voices              — list trained custom voices
  DELETE /voices/{voice_id} — delete a custom voice
"""

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import synthesize, train, voices


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[GPT-SoVITS] Starting on {settings.host}:{settings.port}")
    print(f"[GPT-SoVITS] Pretrained models: {settings.pretrained_models_dir}")
    print(f"[GPT-SoVITS] Custom voices:    {settings.custom_voices_dir}")
    yield
    print("[GPT-SoVITS] Shutting down")


app = FastAPI(
    title="GPT-SoVITS Service",
    description="Custom voice cloning and TTS engine for AstralFox",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(synthesize.router, prefix="/api", tags=["Synthesis"])
app.include_router(train.router, prefix="/api", tags=["Training"])
app.include_router(voices.router, prefix="/api", tags=["Voices"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "gpt-sovits",
        "version": "1.0.0",
        "device": settings.device,
        "uptime_seconds": round(time.time() - _start_time, 1),
    }


_start_time = time.time()
