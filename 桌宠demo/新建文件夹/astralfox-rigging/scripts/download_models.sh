#!/bin/bash
# Download all pre-trained model weights for astralfox-rigging
set -e

echo "=== Downloading models for astralfox-rigging ==="

MODELS_DIR="${1:-./models}"
mkdir -p "$MODELS_DIR"

# SAM2 checkpoint (~224 MB) — requires huggingface_hub
if python3 -c "import torch" 2>/dev/null; then
    echo "[1/2] Downloading SAM2-hiera-large from HuggingFace..."
    pip install huggingface_hub hf_transfer -q
    HF_HUB_ENABLE_HF_TRANSFER=1 python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('facebook/sam2-hiera-large', local_dir='$MODELS_DIR/sam2')
"
else
    echo "[SKIP] PyTorch not installed — SAM2 download skipped (install with: pip install -e '.[gpu]')"
fi

# rembg (u2net ~176 MB) — auto-download on first use
if python3 -c "import rembg" 2>/dev/null; then
    echo "[2/2] Warming up rembg..."
    python3 -c "from rembg import remove; print('rembg ready')"
else
    echo "[SKIP] rembg not installed — u2net download skipped"
fi

echo "=== Done ==="
echo "Models stored in: $MODELS_DIR"
