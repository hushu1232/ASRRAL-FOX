# GPT-SoVITS Service — Voice Cloning & Custom TTS Engine
# Base: official GPT-SoVITS image with CUDA support
# Build: docker build -t gpt-sovits-service .
# Run:   docker run --gpus all -p 8002:8002 gpt-sovits-service

FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

LABEL org.opencontainers.image.title="GPT-SoVITS Service"
LABEL org.opencontainers.image.description="Custom voice cloning and TTS engine for AstralFox desktop pet"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install GPT-SoVITS
WORKDIR /opt/gpt-sovits
RUN git clone --depth 1 https://github.com/RVC-Boss/GPT-SoVITS.git /opt/gpt-sovits && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download base models (GPT + SoVITS checkpoints)
ENV GPT_SOVITS_MODELS_DIR=/opt/gpt-sovits/pretrained_models
RUN mkdir -p ${GPT_SOVITS_MODELS_DIR}

# Install service API dependencies
COPY requirements.txt /tmp/api-requirements.txt
RUN pip install --no-cache-dir -r /tmp/api-requirements.txt

# Application code
WORKDIR /app
COPY app/ /app/

# Model storage (user-trained voice models)
RUN mkdir -p /app/models/voices

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD curl -sf http://localhost:8002/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--log-level", "info"]
