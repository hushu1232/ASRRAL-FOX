"""AI expression variant generator.

Given a neutral face layer, generate expression morph targets
(eye open/close, mouth shapes, eyebrow positions).

Two approaches:
1. SimpleExpressionGenerator — geometric transforms (no AI, fast)
2. ExpressionGenerator — ControlNet + IP-Adapter (high quality, GPU)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


@dataclass
class ExpressionVariant:
    """A single expression morph target."""
    name: str               # e.g., "eye_close_L", "mouth_smile"
    texture: np.ndarray     # RGBA, same size as face
    blend_weight: float     # 0.0 - 1.0, how much to blend
    region: tuple[int, int, int, int] | None = None  # (x, y, w, h) affected area


class SimpleExpressionGenerator:
    """Rule-based expression generator using geometric transforms.

    Applies simple image warping to create expression variants:
    - eye_close: squash eye region vertically
    - mouth_open: stretch mouth region vertically
    - eyebrow_up/down: shift eyebrow region
    - mouth_smile/frown: warp mouth corners

    No GPU required. Results are approximate but good for prototyping.
    """

    MORPH_TARGETS = [
        "eye_close_L", "eye_close_R",
        "mouth_open",
        "mouth_smile", "mouth_frown",
        "eyebrow_up_L", "eyebrow_up_R",
        "eyebrow_down_L", "eyebrow_down_R",
    ]

    def generate(
        self,
        face_texture: np.ndarray,
        targets: Optional[list[str]] = None,
        regions: Optional[dict[str, tuple[int, int, int, int]]] = None,
    ) -> list[ExpressionVariant]:
        """Generate expression variants from a neutral face.

        Args:
            face_texture: RGBA face layer texture (H, W, 4).
            targets: Which morph targets to generate. None = all.
            regions: Optional explicit regions {label: (x, y, w, h)}.
                     If None, uses proportional estimates.

        Returns:
            List of ExpressionVariant.
        """
        if targets is None:
            targets = self.MORPH_TARGETS

        h, w = face_texture.shape[:2]
        results = []

        for target in targets:
            # Get region (explicit or estimated)
            if regions and target in regions:
                region = regions[target]
            else:
                region = self._estimate_region(w, h, target)
                if region is None:
                    continue

            variant = self._apply_transform(face_texture, target, region)
            if variant is not None:
                results.append(variant)

        return results

    def _apply_transform(
        self,
        face: np.ndarray,
        target: str,
        region: tuple[int, int, int, int],
    ) -> Optional[ExpressionVariant]:
        """Apply the appropriate geometric transform for the target."""
        h, w = face.shape[:2]
        x, y, rw, rh = region

        # Clamp region to image bounds
        x = max(0, x)
        y = max(0, y)
        rw = min(rw, w - x)
        rh = min(rh, h - y)
        if rw <= 0 or rh <= 0:
            return None

        result = face.copy()

        if "eye_close" in target:
            result = self._eye_close(result, x, y, rw, rh, w, h)
            weight = 1.0

        elif target == "mouth_open":
            result = self._mouth_open(result, x, y, rw, rh, w, h)
            weight = 1.0

        elif target == "mouth_smile":
            result = self._mouth_warp(result, x, y, rw, rh, w, h, direction=1)
            weight = 0.8

        elif target == "mouth_frown":
            result = self._mouth_warp(result, x, y, rw, rh, w, h, direction=-1)
            weight = 0.8

        elif "eyebrow_up" in target:
            result = self._eyebrow_shift(result, x, y, rw, rh, w, h, dy=-12)
            weight = 1.0

        elif "eyebrow_down" in target:
            result = self._eyebrow_shift(result, x, y, rw, rh, w, h, dy=8)
            weight = 1.0

        else:
            return None

        return ExpressionVariant(
            name=target,
            texture=result,
            blend_weight=weight,
            region=(x, y, rw, rh),
        )

    # ── Geometric transforms ────────────────────────────────────────

    def _eye_close(
        self, img: np.ndarray,
        x: int, y: int, rw: int, rh: int,
        w: int, h: int,
    ) -> np.ndarray:
        """Close eye by squashing the region vertically with smooth blending."""
        roi = img[y:y+rh, x:x+rw]
        if roi.size == 0:
            return img

        # Squash to 15% height
        new_h = max(1, int(rh * 0.15))
        squashed = cv2.resize(roi, (rw, new_h), interpolation=cv2.INTER_AREA)

        # Create blend mask (feathered edges)
        result = img.copy()
        offset = y + (rh - new_h) // 2

        # Blend with soft edge
        for c in range(4):  # RGBA channels
            channel = result[:, :, c].astype(np.float32)
            squashed_ch = squashed[:, :, c].astype(np.float32)

            # Clear original region with fade
            fade = np.linspace(1.0, 0.0, rh).reshape(-1, 1)
            fade = np.tile(fade, (1, rw))
            channel[y:y+rh, x:x+rw] *= (1.0 - fade * 0.8)

            # Paste squashed at center
            end = min(offset + new_h, h)
            paste_h = end - offset
            channel[offset:end, x:x+rw] += squashed_ch[:paste_h, :] * 0.8

            result[:, :, c] = np.clip(channel, 0, 255).astype(np.uint8)

        return result

    def _mouth_open(
        self, img: np.ndarray,
        x: int, y: int, rw: int, rh: int,
        w: int, h: int,
    ) -> np.ndarray:
        """Open mouth by stretching the region vertically."""
        roi = img[y:y+rh, x:x+rw]
        if roi.size == 0:
            return img

        # Stretch to 180% height
        new_h = min(h - y, int(rh * 1.8))
        stretched = cv2.resize(roi, (rw, new_h), interpolation=cv2.INTER_LINEAR)

        result = img.copy()

        # Create dark interior for mouth opening
        interior = np.zeros((new_h, rw, 4), dtype=np.uint8)
        interior[:, :, 3] = 255  # full opacity

        # Blend: original fades out, stretched fades in
        for c in range(4):
            channel = result[:, :, c].astype(np.float32)
            src_ch = stretched[:, :, c].astype(np.float32)

            # Fade original region
            channel[y:y+rh, x:x+rw] *= 0.3

            # Paste stretched
            end = min(y + new_h, h)
            paste_h = end - y
            channel[y:end, x:x+rw] = src_ch[:paste_h, :] * 0.7

            result[:, :, c] = np.clip(channel, 0, 255).astype(np.uint8)

        return result

    def _mouth_warp(
        self, img: np.ndarray,
        x: int, y: int, rw: int, rh: int,
        w: int, h: int,
        direction: int,  # +1 = smile, -1 = frown
    ) -> np.ndarray:
        """Warp mouth corners up (smile) or down (frown)."""
        roi = img[y:y+rh, x:x+rw]
        if roi.size == 0:
            return img

        # Create mesh grid for warping
        map_y, map_x = np.mgrid[0:rh, 0:rw].astype(np.float32)

        # Warp: shift corners vertically
        # Left corner: shift up for smile, down for frown
        # Right corner: same
        corner_shift = direction * rh * 0.3

        # Apply warp gradient (strongest at edges, zero at center)
        for ix in range(rw):
            # Distance from center (0 = center, 1 = edge)
            dist_from_center = abs(ix - rw / 2) / (rw / 2)
            shift = corner_shift * dist_from_center ** 2
            map_y[:, ix] -= shift

        # Clamp
        map_y = np.clip(map_y, 0, rh - 1)

        warped = cv2.remap(roi, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

        result = img.copy()
        result[y:y+rh, x:x+rw] = warped
        return result

    def _eyebrow_shift(
        self, img: np.ndarray,
        x: int, y: int, rw: int, rh: int,
        w: int, h: int,
        dy: int,
    ) -> np.ndarray:
        """Shift eyebrow region vertically."""
        roi = img[y:y+rh, x:x+rw].copy()
        if roi.size == 0:
            return img

        result = img.copy()

        # Clear original region
        result[y:y+rh, x:x+rw] = 0

        # Calculate new position
        new_y = max(0, min(y + dy, h - rh))

        # Paste at new position
        result[new_y:new_y+rh, x:x+rw] = roi

        return result

    # ── Region estimation ───────────────────────────────────────────

    @staticmethod
    def _estimate_region(
        w: int, h: int, target: str
    ) -> Optional[tuple[int, int, int, int]]:
        """Estimate facial feature region based on typical anime proportions.

        These are approximate proportions for a front-facing anime character.
        For better accuracy, provide explicit regions from face detection.
        """
        # Proportional coordinates (normalized 0-1)
        regions = {
            "eye_close_L":   (0.25, 0.35, 0.20, 0.12),
            "eye_close_R":   (0.55, 0.35, 0.20, 0.12),
            "mouth_open":    (0.35, 0.58, 0.30, 0.12),
            "mouth_smile":   (0.35, 0.58, 0.30, 0.12),
            "mouth_frown":   (0.35, 0.58, 0.30, 0.12),
            "eyebrow_up_L":  (0.25, 0.26, 0.20, 0.06),
            "eyebrow_up_R":  (0.55, 0.26, 0.20, 0.06),
            "eyebrow_down_L":(0.25, 0.26, 0.20, 0.06),
            "eyebrow_down_R":(0.55, 0.26, 0.20, 0.06),
        }

        if target not in regions:
            return None

        nx, ny, nw, nh = regions[target]
        return (int(w * nx), int(h * ny), int(w * nw), int(h * nh))


class ExpressionGenerator:
    """AI-powered expression generator using ControlNet + IP-Adapter.

    TODO: Implement diffusion-based expression generation.
    This produces higher quality results than geometric transforms
    but requires GPU and trained models.
    """

    def __init__(self, device: str = "cuda"):
        self.device = device
        self._controlnet = None
        self._ip_adapter = None

    def generate(
        self,
        face_texture: np.ndarray,
        targets: Optional[list[str]] = None,
    ) -> list[ExpressionVariant]:
        """Generate expression variants using AI."""
        # TODO: Implement ControlNet + IP-Adapter pipeline
        # For now, fallback to geometric
        fallback = SimpleExpressionGenerator()
        return fallback.generate(face_texture, targets)
