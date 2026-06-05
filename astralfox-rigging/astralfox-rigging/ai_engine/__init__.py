"""AI Engine: layer separation, bone prediction, weight painting."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Global model cache
_models: dict[str, Any] = {}


async def preload_models(config: dict[str, Any]) -> None:
    """Pre-load AI models into memory/GPU at startup.

    Args:
        config: Model configuration from config.yaml
    """
    global _models

    logger.info("Pre-loading AI models...")

    # Pre-load separator
    try:
        from ai_engine.layer_separator import create_separator
        separator = create_separator(backend="auto")
        _models["separator"] = separator
        logger.info("  ✓ Layer separator loaded")
    except Exception as e:
        logger.warning(f"  ✗ Layer separator failed: {e}")

    # Pre-load bone predictor
    try:
        from ai_engine.bone_predictor import BonePredictor
        predictor = BonePredictor()
        _models["bone_predictor"] = predictor
        logger.info("  ✓ Bone predictor loaded")
    except Exception as e:
        logger.warning(f"  ✗ Bone predictor failed: {e}")

    # Pre-load weight painter
    try:
        from ai_engine.weight_painter import WeightPainter
        painter = WeightPainter(falloff=2.0, max_influences=4)
        _models["weight_painter"] = painter
        logger.info("  ✓ Weight painter loaded")
    except Exception as e:
        logger.warning(f"  ✗ Weight painter failed: {e}")

    logger.info(f"Pre-loaded {len(_models)} models")


def get_model(name: str) -> Any:
    """Get a pre-loaded model by name."""
    return _models.get(name)


def is_preloaded(name: str) -> bool:
    """Check if a model is pre-loaded."""
    return name in _models
