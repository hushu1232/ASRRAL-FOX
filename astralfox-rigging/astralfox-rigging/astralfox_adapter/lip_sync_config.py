"""Lip sync configuration for AstralFox.

Maps audio amplitude to mouth parameter (ParamMouthOpenY).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class LipSyncConfig:
    """Configuration for audio-driven lip sync."""
    param_id: str = "ParamMouthOpenY"
    min_amplitude: float = 0.05    # noise gate
    max_amplitude: float = 0.8     # saturation point
    smoothing: float = 0.3         # exponential smoothing factor
    open_speed: float = 0.8        # mouth open interpolation
    close_speed: float = 0.4       # mouth close interpolation (faster close)

    def to_dict(self) -> dict[str, Any]:
        return {
            "paramId": self.param_id,
            "minAmplitude": self.min_amplitude,
            "maxAmplitude": self.max_amplitude,
            "smoothing": self.smoothing,
            "openSpeed": self.open_speed,
            "closeSpeed": self.close_speed,
        }

    def write(self, path: str | Path) -> Path:
        path = Path(path)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
        return path
