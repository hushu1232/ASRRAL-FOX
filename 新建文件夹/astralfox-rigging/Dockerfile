# GPU-enabled image
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    RIGGING_HOST=0.0.0.0 \
    RIGGING_PORT=8001

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3.11 /usr/bin/python3

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[gpu]"

COPY . .

RUN mkdir -p /app/data/storage /app/models

EXPOSE 8001

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001"]
