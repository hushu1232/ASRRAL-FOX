"""Layer separation API route with diagnostic checks and fallback."""

from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api.schemas import SeparateRequest, SeparateResponse, LayerResult
from api.errors import (
    ErrorCode, SeparationError, get_user_message,
    diagnose_image, diagnose_mask,
)
from ai_engine.layer_separator import create_separator, SimpleLayerSeparator

router = APIRouter()
logger = logging.getLogger(__name__)

_separator = None
_simple_separator = None
_config = None


def _get_config():
    global _config
    if _config is None:
        import yaml
        from pathlib import Path
        config_path = Path(__file__).parent.parent.parent / "config.yaml"
        with open(config_path, encoding="utf-8") as f:
            _config = yaml.safe_load(f)
    return _config


def _rembg_model_path() -> str | None:
    cfg = _get_config()
    path = cfg.get("models", {}).get("rembg", {}).get("model_path", "")
    if path and Path(path).exists():
        return path
    return None


def _mobilesam_checkpoint() -> str | None:
    cfg = _get_config()
    path = cfg.get("models", {}).get("mobilesam", {}).get("checkpoint", "")
    if path and Path(path).exists():
        return path
    return None


def _get_separator():
    global _separator
    if _separator is None:
        _separator = create_separator(
            backend="auto",
            rembg_model_path=_rembg_model_path(),
            mobilesam_checkpoint=_mobilesam_checkpoint(),
        )
    return _separator


def _get_simple_separator():
    global _simple_separator
    if _simple_separator is None:
        _simple_separator = SimpleLayerSeparator(model_path=_rembg_model_path())
    return _simple_separator


@router.post("/", response_model=SeparateResponse)
async def separate_layers(req: SeparateRequest) -> SeparateResponse:
    """Separate an uploaded image into labeled layers using AI.

    Includes:
    - Image diagnostic checks before processing
    - Fallback to simple separator if smart separator fails
    - Mask quality validation
    """
    t0 = time.perf_counter()

    # Resolve uploaded image
    upload_dir = Path("output/uploads")
    matches = list(upload_dir.glob(f"{req.image_id}.*"))
    if not matches:
        raise HTTPException(404, f"Image {req.image_id} not found. Upload first via /api/upload.")

    image_path = matches[0]

    # Step 1: Run diagnostic checks
    diag = diagnose_image(image_path)
    if not diag.passed:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": diag.error_code.value,
                "message": get_user_message(diag.error_code),
                "detail": diag.message,
            }
        )

    # Log warnings
    for warning in diag.warnings:
        logger.warning(f"[{req.image_id}] {warning}")

    # Step 2: Try smart separation, fallback to simple
    separator = _get_separator()
    raw_layers = None
    used_fallback = False

    try:
        raw_layers = separator.separate(
            image_path=image_path,
            target_labels=[l.value for l in req.target_layers],
            edge_refine=req.edge_refine,
        )
    except Exception as e:
        logger.warning(f"Smart separation failed: {e}, trying fallback...")
        used_fallback = True

    # Fallback to simple separator
    if raw_layers is None or len(raw_layers) == 0:
        try:
            simple_sep = _get_simple_separator()
            raw_layers = simple_sep.separate(
                image_path=image_path,
                edge_refine=req.edge_refine,
            )
            used_fallback = True
            logger.info(f"Fallback separation produced {len(raw_layers)} layers")
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "error_code": ErrorCode.SEPARATION_FAILED.value,
                    "message": get_user_message(ErrorCode.SEPARATION_FAILED),
                    "detail": str(e),
                }
            )

    # Step 3: Validate masks and filter out too-small layers
    out_dir = Path("output") / req.image_id / "layers"
    out_dir.mkdir(parents=True, exist_ok=True)

    layers = []
    skipped_layers = []

    for layer in raw_layers:
        # Check mask quality
        mask_diag = diagnose_mask(layer.mask, min_area=50)
        if not mask_diag.passed:
            skipped_layers.append(layer.label)
            logger.warning(f"Skipping layer {layer.label}: {mask_diag.message}")
            continue

        tex_path = out_dir / f"{layer.label}.png"
        mask_path = out_dir / f"{layer.label}_mask.png"
        layer.save_texture(tex_path)
        layer.save_mask(mask_path)
        layers.append(LayerResult(
            label=layer.label,
            texture_url=f"/static/output/{req.image_id}/layers/{layer.label}.png",
            mask_url=f"/static/output/{req.image_id}/layers/{layer.label}_mask.png",
            bbox=layer.bbox,
        ))

    # Check if we have enough layers
    if len(layers) < 2:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.LAYERS_TOO_FEW.value,
                "message": get_user_message(ErrorCode.LAYERS_TOO_FEW),
                "detail": f"Only {len(layers)} valid layers found",
            }
        )

    elapsed = (time.perf_counter() - t0) * 1000

    # Build response with warnings
    response = SeparateResponse(
        image_id=req.image_id,
        layers=layers,
        processing_time_ms=round(elapsed, 1),
    )

    # Add metadata about fallback usage
    if used_fallback:
        logger.info(f"[{req.image_id}] Used fallback separator")
    if skipped_layers:
        logger.info(f"[{req.image_id}] Skipped layers: {skipped_layers}")

    return response
