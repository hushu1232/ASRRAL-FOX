"""Layer separation — SAM2-based (GPU) with CPU fallback."""

import time
import numpy as np
from PIL import Image, ImageFilter
from io import BytesIO
from loguru import logger

from api.dependencies import get_storage
from core.config import settings


def _pil_to_numpy(img: Image.Image) -> np.ndarray:
    return np.array(img.convert("RGBA"))


def _numpy_to_png_bytes(arr: np.ndarray) -> bytes:
    img = Image.fromarray(arr.astype(np.uint8), "RGBA")
    buf = BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _crop_to_bbox(img: Image.Image, alpha: np.ndarray) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Crop image to alpha bounding box with padding."""
    rows = np.any(alpha > 30, axis=1)
    cols = np.any(alpha > 30, axis=0)
    if not rows.any() or not cols.any():
        return img, (0, 0, img.width, img.height)

    ymin, ymax = np.where(rows)[0][[0, -1]]
    xmin, xmax = np.where(cols)[0][[0, -1]]
    pad = 4
    ymin = max(0, ymin - pad)
    ymax = min(img.height, ymax + pad + 1)
    xmin = max(0, xmin - pad)
    xmax = min(img.width, xmax + pad + 1)

    cropped = img.crop((xmin, ymin, xmax, ymax))
    return cropped, (xmin, ymin, xmax - xmin, ymax - ymin)


# ── CPU fallback: edge-aware region extraction ─────────

def _cpu_separate(image_id: str, target_layers: list[str], edge_refine: bool) -> list[dict]:
    """Simple color+edge based segmentation — usable without GPU."""
    storage = get_storage()

    # Find the original uploaded file
    import os
    img_dir = storage._safe_path(f"images/{image_id}")
    files = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not files:
        raise FileNotFoundError(f"No image found for {image_id}")
    raw = storage.download(f"images/{image_id}/{files[0]}")

    img = Image.open(BytesIO(raw)).convert("RGBA")
    w, h = img.size
    arr = np.array(img)

    # Simple region masks based on position heuristics
    regions = {
        "body":       (0.15, 0.40, 0.85, 0.75),   # central torso
        "face":       (0.30, 0.05, 0.70, 0.30),   # upper-center (head)
        "hair_back":  (0.05, 0.00, 0.95, 0.20),   # behind head
        "hair_front": (0.10, 0.05, 0.90, 0.35),   # front of face
        "eye_L":      (0.32, 0.12, 0.48, 0.22),   # left eye region
        "eye_R":      (0.52, 0.12, 0.68, 0.22),   # right eye region
        "eyebrow_L":  (0.32, 0.08, 0.48, 0.14),   # left brow
        "eyebrow_R":  (0.52, 0.08, 0.68, 0.14),   # right brow
        "mouth":      (0.38, 0.24, 0.62, 0.35),   # mouth area
        "accessory":  (0.00, 0.00, 0.05, 0.05),   # negligible
    }

    layers = []
    for label in target_layers:
        if label not in regions:
            continue

        rx, ry, rw, rh = regions[label]
        x = int(rx * w)
        y = int(ry * h)
        rw_px = int(rw * w)
        rh_px = int(rh * h)

        # Create mask for this region
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[y:y+rh_px, x:x+rw_px] = 255

        if edge_refine:
            mask_img = Image.fromarray(mask)
            mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=2))
            mask = np.array(mask_img)

        # Extract alpha from mask
        rgba = arr.copy()
        rgba[:, :, 3] = mask

        cropped, bbox = _crop_to_bbox(Image.fromarray(rgba, "RGBA"), mask)

        # Store layer as PNG
        layer_data = _numpy_to_png_bytes(np.array(cropped))
        label_key = f"separate/{image_id}/{label}.png"
        texture_url = storage.upload(label_key, layer_data, "image/png")

        # Create mask as grayscale PNG
        mask_cropped = Image.fromarray(mask).crop((
            bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]
        ))
        mask_data = _numpy_to_png_bytes(np.stack([
            np.array(mask_cropped),
            np.array(mask_cropped),
            np.array(mask_cropped),
            np.array(mask_cropped),
        ], axis=-1))
        mask_key = f"separate/{image_id}/{label}_mask.png"
        mask_url = storage.upload(mask_key, mask_data, "image/png")

        layers.append({
            "label": label,
            "texture_url": texture_url,
            "mask_url": mask_url,
            "bbox": [int(v) for v in bbox],
        })

    return layers


# ── GPU path: SAM2 + rembg ─────────────────────────────

# Region definitions for body-part heuristics (same as CPU path)
_GPU_REGIONS = {
    "body":       (0.15, 0.40, 0.70, 0.50),
    "face":       (0.30, 0.05, 0.40, 0.25),
    "hair_back":  (0.05, 0.00, 0.90, 0.20),
    "hair_front": (0.10, 0.05, 0.80, 0.35),
    "eye_L":      (0.32, 0.12, 0.16, 0.08),
    "eye_R":      (0.52, 0.12, 0.16, 0.08),
    "eyebrow_L":  (0.32, 0.08, 0.16, 0.06),
    "eyebrow_R":  (0.52, 0.08, 0.16, 0.06),
    "mouth":      (0.38, 0.24, 0.24, 0.10),
    "accessory":  (0.02, 0.02, 0.06, 0.06),
}


def _region_mask(w: int, h: int, label: str, edge_refine: bool) -> np.ndarray:
    """Create a position-based soft mask for a body-part label."""
    if label not in _GPU_REGIONS:
        return np.zeros((h, w), dtype=np.uint8)

    rx, ry, rw, rh = _GPU_REGIONS[label]
    mask = np.zeros((h, w), dtype=np.float32)

    # Gaussian-like soft region
    cy = int((ry + rh / 2) * h)
    cx = int((rx + rw / 2) * w)
    sy = max(1, int(rh * h / 3))
    sx = max(1, int(rw * w / 3))

    ys = np.arange(h, dtype=np.float32).reshape(-1, 1)
    xs = np.arange(w, dtype=np.float32).reshape(1, -1)
    gauss = np.exp(-0.5 * (((ys - cy) / sy) ** 2 + ((xs - cx) / sx) ** 2))
    mask = np.clip(gauss * 255, 0, 255).astype(np.uint8)

    if edge_refine:
        mask_img = Image.fromarray(mask)
        mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=3))
        mask = np.array(mask_img)

    return mask


def _load_sam2_model():
    """Load SAM2 model if checkpoint is available.

    SAM2 (Segment Anything Model 2) enables text-prompted per-layer
    semantic segmentation. Requires downloading the checkpoint from
    https://github.com/facebookresearch/sam2

    Returns None when checkpoint not found; caller should fall back to
    rembg + region heuristics.
    """
    import os as _os
    from core.config import settings

    checkpoint_path = _os.path.join(settings.MODELS_DIR, "sam2_hiera_large.pt")
    if not _os.path.exists(checkpoint_path):
        logger.info(
            f"SAM2 checkpoint not found at {checkpoint_path}. "
            "Download: wget https://dl.fbaipublicfiles.com/sam2/sam2_hiera_large.pt "
            f"-O {checkpoint_path}"
        )
        return None

    try:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        device = "cuda" if _torch_cuda_available() else "cpu"
        sam2 = build_sam2("sam2_hiera_l.yaml", checkpoint_path, device=device)
        predictor = SAM2ImagePredictor(sam2)
        logger.info(f"SAM2 model loaded on {device}")
        return predictor
    except ImportError:
        logger.warning("sam2 package not installed. Run: pip install sam2")
        return None
    except Exception as e:
        logger.warning(f"SAM2 model loading failed: {e}")
        return None


def _torch_cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _gpu_separate(image_id: str, target_layers: list[str], edge_refine: bool) -> list[dict]:
    """GPU-accelerated layer separation.

    Priority: SAM2 > rembg + region heuristics
    """
    try:
        from rembg import remove
    except ImportError:
        raise RuntimeError(
            "GPU dependencies not installed. Run: pip install -e '.[gpu]'"
        ) from e

    storage = get_storage()
    import os
    img_dir = storage._safe_path(f"images/{image_id}")
    files = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not files:
        raise FileNotFoundError(f"No image found for {image_id}")
    raw = storage.download(f"images/{image_id}/{files[0]}")

    img = Image.open(BytesIO(raw)).convert("RGBA")
    w, h = img.size
    arr = np.array(img)

    # Try SAM2 first
    sam2 = _load_sam2_model()
    if sam2 is not None:
        return _sam2_separate(sam2, storage, image_id, arr, w, h, target_layers, edge_refine)

    # Fallback: rembg foreground detection + position-based region masks
    logger.info("using rembg + region heuristics for per-layer separation")
    nobg = remove(raw)
    nobg_img = Image.open(BytesIO(nobg)).convert("RGBA")
    nobg_arr = np.array(nobg_img)
    fg_alpha = nobg_arr[:, :, 3]  # foreground alpha from rembg

    layers = []
    for label in target_layers:
        # Create region mask for this body part
        region = _region_mask(w, h, label, edge_refine)

        # Intersect foreground alpha with region mask
        combined = np.minimum(fg_alpha.astype(np.float32), region.astype(np.float32))
        mask = np.clip(combined, 0, 255).astype(np.uint8)

        # Apply mask to original image (not rembg output — keeps original color)
        rgba = arr.copy()
        rgba[:, :, 3] = mask
        cropped, bbox = _crop_to_bbox(Image.fromarray(rgba, "RGBA"), mask)

        layer_data = _numpy_to_png_bytes(np.array(cropped))
        label_key = f"separate/{image_id}/{label}.png"
        texture_url = storage.upload(label_key, layer_data, "image/png")

        mask_key = f"separate/{image_id}/{label}_mask.png"
        mask_url = storage.upload(mask_key, _numpy_to_png_bytes(
            np.stack([mask, mask, mask, mask], axis=-1)
        ), "image/png")

        layers.append({
            "label": label,
            "texture_url": texture_url,
            "mask_url": mask_url,
            "bbox": [int(v) for v in bbox],
        })

    return layers


def _sam2_separate(predictor, storage, image_id, arr, w, h, target_layers, edge_refine) -> list[dict]:
    """SAM2-based per-layer segmentation with text prompts."""
    import os as _os

    # Save temp image for SAM2
    temp_path = _os.path.join(storage._safe_path("images"), f"_sam2_temp_{image_id}.png")
    Image.fromarray(arr, "RGBA").save(temp_path)

    try:
        predictor.set_image(np.array(Image.open(temp_path).convert("RGB")))
    finally:
        # Clean up temp file
        try:
            _os.remove(temp_path)
        except OSError:
            pass

    prompt_map = {
        "body": "the character's body and torso",
        "face": "the character's face",
        "hair_back": "hair behind the head",
        "hair_front": "hair in front of the face",
        "eye_L": "the left eye",
        "eye_R": "the right eye",
        "eyebrow_L": "the left eyebrow",
        "eyebrow_R": "the right eyebrow",
        "mouth": "the mouth",
        "accessory": "accessories and decorations",
    }

    layers = []
    for label in target_layers:
        prompt = prompt_map.get(label, label)
        try:
            masks, scores, _ = predictor.predict(
                point_coords=None,
                point_labels=None,
                text_prompt=prompt,
                multimask_output=False,
            )
            mask = (masks[0] * 255).astype(np.uint8) if masks.shape[0] > 0 else np.zeros((h, w), dtype=np.uint8)
        except Exception as e:
            logger.warning(f"SAM2 prediction failed for '{label}', using zero mask: {e}")
            mask = np.zeros((h, w), dtype=np.uint8)

        if edge_refine:
            mask_img = Image.fromarray(mask)
            mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=2))
            mask = np.array(mask_img)

        rgba = arr.copy()
        rgba[:, :, 3] = mask
        cropped, bbox = _crop_to_bbox(Image.fromarray(rgba, "RGBA"), mask)

        layer_data = _numpy_to_png_bytes(np.array(cropped))
        label_key = f"separate/{image_id}/{label}.png"
        texture_url = storage.upload(label_key, layer_data, "image/png")

        mask_key = f"separate/{image_id}/{label}_mask.png"
        mask_url = storage.upload(mask_key, _numpy_to_png_bytes(
            np.stack([mask, mask, mask, mask], axis=-1)
        ), "image/png")

        layers.append({
            "label": label,
            "texture_url": texture_url,
            "mask_url": mask_url,
            "bbox": [int(v) for v in bbox],
        })

    return layers


# ── Public API ─────────────────────────────────────────

def separate_layers(
    image_id: str,
    target_layers: list[str] | None = None,
    edge_refine: bool = True,
) -> dict:
    """
    Separate an uploaded image into semantic layers.

    Returns: { image_id, layers: [{label, textureUrl, maskUrl, bbox}], processingTimeMs }
    """
    if target_layers is None:
        target_layers = [
            "hair_back", "body", "hair_front", "face",
            "eye_L", "eye_R", "eyebrow_L", "eyebrow_R",
            "mouth", "accessory",
        ]

    start = time.perf_counter()

    gpu_ok = False
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        gpu_ok = any(p in providers for p in ("DmlExecutionProvider", "CUDAExecutionProvider"))
    except ImportError:
        try:
            import torch
            gpu_ok = torch.cuda.is_available()
        except ImportError:
            pass

    try:
        if gpu_ok:
            logger.info("using GPU path for separation")
            layers = _gpu_separate(image_id, target_layers, edge_refine)
        else:
            logger.info("using CPU fallback for separation")
            layers = _cpu_separate(image_id, target_layers, edge_refine)
    except Exception:
        logger.warning("GPU path failed, falling back to CPU")
        layers = _cpu_separate(image_id, target_layers, edge_refine)

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return {
        "image_id": image_id,
        "layers": layers,
        "processing_time_ms": elapsed_ms,
    }
