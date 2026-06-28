"""Model deployment — copy to target directory + write configs."""

import json
import time
from loguru import logger

from api.dependencies import get_storage


def deploy_model(
    model_id: str,
    anim_params: dict | None = None,
    target_name: str | None = None,
) -> dict:
    """Deploy exported model to the target directory.

    Copies model files, writes Live2D config, and attempts to notify
    the Alife runtime via WebSocket reload signal.
    """
    start = time.perf_counter()
    storage = get_storage()

    if target_name is None:
        target_name = f"model_{model_id[:8]}"

    export_prefix = f"export/{model_id}"
    deploy_prefix = f"deploy/{target_name}"

    if not storage.exists(export_prefix):
        raise FileNotFoundError(f"Exported model not found: {model_id}")

    # Copy exported files
    copied = []
    for src_key in storage.list(export_prefix):
        rel = src_key[len(export_prefix):].lstrip("/\\")
        dst_key = f"{deploy_prefix}/{rel}"
        data = storage.download(src_key)
        storage.upload(dst_key, data, "application/octet-stream")
        copied.append(dst_key)

    # Write Live2D runtime config
    config = {
        "model_name": target_name,
        "moc3_path": f"{deploy_prefix}/model.moc3",
        "model3_json_path": f"{deploy_prefix}/model.model3.json",
        "physics3_json_path": f"{deploy_prefix}/model.physics3.json",
        "animation_params": anim_params or _default_anim_params(),
    }
    config_key = f"{deploy_prefix}/pet_config.json"
    storage.upload(config_key, json.dumps(config, indent=2).encode(), "application/json")
    copied.append(config_key)

    # Attempt WebSocket hot-reload signal (best-effort)
    reload_triggered = _try_reload_signal(target_name)

    deployed_path = str(storage._safe_path(deploy_prefix))
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(f"deployed {model_id} -> {deploy_prefix} ({len(copied)} files, reload={reload_triggered})")

    return {
        "model_id": model_id,
        "deployed_path": deployed_path,
        "reload_triggered": reload_triggered,
        "configs_written": copied,
        "processing_time_ms": elapsed_ms,
    }


def _default_anim_params() -> dict:
    return {
        "ParamBodyAngleX": {"min": -30, "max": 30, "default": 0},
        "ParamBodyAngleY": {"min": -30, "max": 30, "default": 0},
        "ParamEyeBallX": {"min": -1, "max": 1, "default": 0},
        "ParamEyeBallY": {"min": -1, "max": 1, "default": 0},
        "ParamAngleZ": {"min": -30, "max": 30, "default": 0},
        "ParamEyeLOpen": {"min": 0, "max": 1, "default": 1},
        "ParamEyeROpen": {"min": 0, "max": 1, "default": 1},
        "ParamMouthOpenY": {"min": 0, "max": 1, "default": 0},
        "ParamBreath": {"min": 0, "max": 1, "default": 0},
    }


def _try_reload_signal(target_name: str) -> bool:
    """Attempt to notify Alife runtime via WebSocket reload signal."""
    logger.debug(f"reload signal queued for {target_name} (no Alife runtime connected)")
    return False
