"""Parameter mapping between Cubism model and AstralFox animation states.

Maps Live2D parameters to the 6 AstralFox states:
idle, listen, speak, sleep, drag, greet
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class ParamRange:
    """A parameter's target range for an animation state."""
    target: float = 0.0
    speed: float = 0.3         # interpolation speed (0-1)
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    sync: Optional[str] = None  # "audio_amplitude", "blink_interval", etc.


@dataclass
class AnimStateConfig:
    """Configuration for a single animation state."""
    triggers: list[str] = field(default_factory=list)
    params: dict[str, ParamRange] = field(default_factory=dict)


class ParamMapper:
    """Generate and manage AstralFox animation parameter mappings."""

    # Default AstralFox animation states
    DEFAULT_STATES: dict[str, AnimStateConfig] = {
        "idle": AnimStateConfig(
            triggers=["default"],
            params={
                "ParamAngleX": ParamRange(min_val=-5, max_val=5, speed=0.3),
                "ParamAngleY": ParamRange(min_val=-3, max_val=3, speed=0.2),
                "ParamBreath": ParamRange(target=1.0, speed=0.5),
                "ParamTail": ParamRange(min_val=-0.3, max_val=0.3, speed=0.4),
            },
        ),
        "listen": AnimStateConfig(
            triggers=["asr_start"],
            params={
                "ParamEyeLOpen": ParamRange(target=1.0, speed=0.5),
                "ParamEyeROpen": ParamRange(target=1.0, speed=0.5),
                "ParamBodyAngleZ": ParamRange(min_val=-3, max_val=3, speed=0.3),
            },
        ),
        "speak": AnimStateConfig(
            triggers=["tts_start"],
            params={
                "ParamMouthOpenY": ParamRange(sync="audio_amplitude", speed=0.8),
                "ParamEyeLOpen": ParamRange(sync="blink_interval", speed=0.3),
                "ParamTail": ParamRange(target=0.7, speed=0.5),
            },
        ),
        "sleep": AnimStateConfig(
            triggers=["idle_timeout"],
            params={
                "ParamEyeLOpen": ParamRange(target=0.0, speed=0.1),
                "ParamEyeROpen": ParamRange(target=0.0, speed=0.1),
                "ParamBreath": ParamRange(target=0.5, speed=0.2),
                "ParamAngleY": ParamRange(target=-10, speed=0.1),
            },
        ),
        "drag": AnimStateConfig(
            triggers=["mouse_drag"],
            params={
                "ParamAngleX": ParamRange(sync="drag_delta_x", speed=0.5),
                "ParamAngleY": ParamRange(sync="drag_delta_y", speed=0.5),
                "ParamEyeBallX": ParamRange(sync="drag_delta_x", speed=0.8),
                "ParamEyeBallY": ParamRange(sync="drag_delta_y", speed=0.8),
            },
        ),
        "greet": AnimStateConfig(
            triggers=["wake_word", "app_launch"],
            params={
                "ParamMouthOpenY": ParamRange(target=0.5, speed=0.6),
                "ParamEyeLOpen": ParamRange(target=1.0, speed=0.8),
                "ParamTail": ParamRange(target=1.0, speed=0.7),
            },
        ),
    }

    def generate_config(
        self,
        overrides: Optional[dict[str, dict]] = None,
        output_path: Optional[str | Path] = None,
    ) -> dict[str, Any]:
        """Generate a complete animation config.

        Args:
            overrides: Per-state parameter overrides.
            output_path: If provided, write JSON to this path.

        Returns:
            Config dict.
        """
        config = {}

        for state_name, state_cfg in self.DEFAULT_STATES.items():
            params = {}

            # Default params
            for pname, prange in state_cfg.params.items():
                params[pname] = {
                    "target": prange.target,
                    "speed": prange.speed,
                    "min": prange.min_val,
                    "max": prange.max_val,
                    "sync": prange.sync,
                }

            # Apply overrides
            if overrides and state_name in overrides:
                for pname, pval in overrides[state_name].items():
                    if pname in params:
                        params[pname].update(pval)
                    else:
                        params[pname] = pval

            config[state_name] = {
                "triggers": state_cfg.triggers,
                "params": params,
            }

        if output_path:
            Path(output_path).write_text(
                json.dumps(config, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

        return config
