"""
GPT-SoVITS Service configuration.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Service
    host: str = "0.0.0.0"
    port: int = 8002
    debug: bool = False

    # GPT-SoVITS paths
    gpt_sovits_path: str = "/opt/gpt-sovits"
    pretrained_models_dir: str = "/opt/gpt-sovits/pretrained_models"
    custom_voices_dir: str = "/app/models/voices"

    # Model defaults
    default_gpt_model: str = "s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt"
    default_sovits_model: str = "s2G488k.pth"

    # Inference defaults
    default_ref_audio: str = ""
    default_prompt_text: str = ""
    default_prompt_lang: str = "zh"

    # Training limits
    max_upload_size_mb: int = 100
    max_audio_duration_seconds: int = 300  # 5 minutes
    min_audio_duration_seconds: int = 30   # 30 seconds

    # GPU
    device: str = "cuda"
    is_half: bool = True

    model_config = {"env_prefix": "GPT_SOVITS_"}


settings = Settings()
