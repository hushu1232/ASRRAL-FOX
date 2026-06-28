"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "astralfox-rigging"
    APP_VERSION: str = "0.1.0"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    # Storage
    STORAGE_DIR: str = "./data/storage"
    MODELS_DIR: str = "./models"
    MAX_UPLOAD_MB: int = 10

    # Pipeline defaults
    CANVAS_WIDTH: int = 3000
    CANVAS_HEIGHT: int = 4000
    TEXTURE_SIZE: int = 2048

    # GPU
    GPU_ENABLED: bool = True
    CPU_FALLBACK: bool = True

    # Runtime integration
    RUNTIME_WS_URL: str = "ws://localhost:3001"

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = {"env_prefix": "RIGGING_", "env_file": ".env"}


settings = Settings()
