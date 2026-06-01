#!/usr/bin/env python3
"""Verify astralfox-rigging environment setup."""

import sys
import importlib

CHECKS = [
    ("fastapi", "FastAPI framework"),
    ("uvicorn", "ASGI server"),
    ("PIL", "Pillow — image processing"),
    ("numpy", "NumPy — numerical computing"),
    ("pydantic_settings", "Pydantic Settings — configuration"),
    ("loguru", "Loguru — structured logging"),
]

GPU_CHECKS = [
    ("torch", "PyTorch — deep learning runtime"),
    ("torchvision", "TorchVision — image transforms"),
    ("rembg", "rembg — background removal"),
    ("scipy", "SciPy — scientific computing"),
    ("skimage", "scikit-image — image processing"),
    ("shapely", "Shapely — geometry"),
]

def main():
    ok = 0
    fail = 0

    print("Core dependencies:")
    for mod, desc in CHECKS:
        try:
            importlib.import_module(mod)
            print(f"  [PASS] {desc}")
            ok += 1
        except ImportError:
            print(f"  [MISS] {desc}")
            fail += 1

    print("\nGPU dependencies (optional):")
    for mod, desc in GPU_CHECKS:
        try:
            importlib.import_module(mod)
            print(f"  [PASS] {desc}")
            ok += 1
        except ImportError:
            print(f"  [MISS] {desc}")

    # CUDA check
    try:
        import torch
        if torch.cuda.is_available():
            print(f"\n  GPU: {torch.cuda.get_device_name(0)} ({torch.cuda.device_count()} device(s))")
        else:
            print("\n  GPU: not available (CPU-only)")
    except ImportError:
        print("\n  GPU: PyTorch not installed")

    print(f"\n{ok} passed, {fail} missing")
    sys.exit(0 if fail == 0 else 1)

if __name__ == "__main__":
    main()
