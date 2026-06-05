"""One-click deploy model to AstralFox desktop pet.

Copies model files to Unity StreamingAssets and triggers hot reload.
Writes state machine, animation params, and lip sync configs.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import yaml

from astralfox_adapter.anim_state_machine import StateMachineConfig
from astralfox_adapter.lip_sync_config import LipSyncConfig
from astralfox_adapter.param_mapper import ParamMapper
from deploy.validator import ModelValidator


@dataclass
class DeployResult:
    deployed_path: str
    reload_triggered: bool
    configs_written: list[str]


class AstralFoxDeployer:
    """Deploy a rigged model to the AstralFox Unity project."""

    def __init__(self, config_path: str | Path = "config.yaml"):
        with open(config_path, encoding="utf-8") as f:
            config = yaml.safe_load(f)

        self.unity_project = Path(config["astralfox"]["unity_project_path"])
        self.models_dir = self.unity_project / config["astralfox"]["models_dir"]
        self.ws_url = config["astralfox"]["websocket_url"]
        self.auto_reload = config["astralfox"]["auto_reload"]
        self.validator = ModelValidator()

    def deploy(
        self,
        model_id: str,
        anim_params: Optional[dict[str, Any]] = None,
        target_name: Optional[str] = None,
    ) -> DeployResult:
        """Deploy an exported model to AstralFox.

        Args:
            model_id: ID of the exported model (from /api/export).
            anim_params: Per-animation-state parameter overrides.
            target_name: Name for the model directory.

        Returns:
            DeployResult with deployment info.

        Raises:
            FileNotFoundError: If model export not found.
            ValueError: If validation fails.
        """
        # Find exported model
        model_dir = Path("output") / model_id / "cubism"
        if not model_dir.exists():
            raise FileNotFoundError(f"Model export not found: {model_dir}")

        # Validate
        result = self.validator.validate(model_dir)
        if not result.valid:
            raise ValueError(f"Model validation failed:\n{result}")

        # Prepare target directory
        name = target_name or model_id
        target = self.models_dir / name
        target.mkdir(parents=True, exist_ok=True)

        # Copy files
        self._copy_model(model_dir, target)

        # Write AstralFox configs
        configs_written = self._write_astralfox_configs(target, anim_params)

        # Trigger hot reload
        reloaded = False
        if self.auto_reload:
            reloaded = self._trigger_reload(name)

        return DeployResult(
            deployed_path=str(target),
            reload_triggered=reloaded,
            configs_written=configs_written,
        )

    def _copy_model(self, src: Path, dst: Path) -> None:
        """Copy model files to target directory."""
        # Copy core files
        for f in src.glob("model.*"):
            shutil.copy2(f, dst / f.name)

        # Copy textures directory
        src_tex = src / "textures"
        if src_tex.exists():
            dst_tex = dst / "textures"
            if dst_tex.exists():
                shutil.rmtree(dst_tex)
            shutil.copytree(src_tex, dst_tex)

    def _write_astralfox_configs(
        self,
        model_dir: Path,
        anim_overrides: Optional[dict[str, Any]] = None,
    ) -> list[str]:
        """Write all AstralFox configuration files.

        Returns list of written config file names.
        """
        written: list[str] = []

        # 1. Animation params (per-state parameter mappings)
        mapper = ParamMapper()
        config = mapper.generate_config(overrides=anim_overrides)
        anim_path = model_dir / "anim_params.json"
        anim_path.write_text(
            json.dumps(config, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        written.append("anim_params.json")

        # 2. State machine config
        sm = StateMachineConfig()
        sm_path = model_dir / "state_machine.json"
        sm.write(sm_path)
        written.append("state_machine.json")

        # 3. Lip sync config
        lip = LipSyncConfig()
        lip_path = model_dir / "lipsync.json"
        lip.write(lip_path)
        written.append("lipsync.json")

        return written

    def _trigger_reload(self, model_name: str) -> bool:
        """Send WebSocket command to AstralFox to hot-reload the model."""
        import asyncio

        async def _send():
            try:
                import websockets
                async with websockets.connect(self.ws_url, open_timeout=3) as ws:
                    cmd = json.dumps({
                        "type": "reload_model",
                        "model": model_name,
                    })
                    await ws.send(cmd)
                    return True
            except Exception:
                return False

        try:
            return asyncio.run(_send())
        except Exception:
            return False
