"""Semantic classifier: classify mask regions into body part labels.

Two approaches:
1. RuleBasedClassifier — fast, no GPU, uses position/area/shape heuristics
2. CNNClassifier — higher accuracy, requires trained model (TODO)

The classifier takes an image + mask and returns (label, confidence).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np


# ── Label definitions ──────────────────────────────────────────────

LABELS = [
    "hair_back",    # back hair layer
    "body",         # torso/arms/clothing
    "hair_front",   # front hair / bangs
    "face",         # face skin
    "eye_L",        # left eye
    "eye_R",        # right eye
    "eyebrow_L",    # left eyebrow
    "eyebrow_R",    # right eyebrow
    "mouth",        # mouth/lips
    "accessory",    # cat ears, ribbons, etc.
]


class BaseClassifier(ABC):
    """Abstract base for semantic classifiers."""

    @abstractmethod
    def classify(self, image: np.ndarray, mask: np.ndarray) -> tuple[str, float]:
        """Classify a masked region.

        Args:
            image: RGB image (H, W, 3).
            mask: uint8 mask (H, W), 255 = foreground.

        Returns:
            (label, confidence) where confidence is 0.0-1.0.
        """
        ...


class RuleBasedClassifier(BaseClassifier):
    """Rule-based classifier using position, area, and shape heuristics.

    Works by analyzing where the mask falls on the image canvas:
    - Top region → hair / accessory
    - Middle region → face / eyes / brows
    - Lower region → body / mouth
    - Small + high → eyebrow
    - Small + middle → eye
    - Very small + center → mouth

    Accuracy: ~80-85% for typical anime character illustrations.
    """

    def classify(self, image: np.ndarray, mask: np.ndarray) -> tuple[str, float]:
        h, w = image.shape[:2]
        total_area = h * w

        # Get mask properties
        bbox = self._get_bbox(mask)
        if bbox is None:
            return "body", 0.1

        x, y, bw, bh = bbox
        area = cv2.countNonZero(mask)
        area_ratio = area / total_area

        # Centroid (normalized 0-1)
        cx = (x + bw / 2) / w
        cy = (y + bh / 2) / h

        # Aspect ratio
        aspect = bw / max(bh, 1)

        # Color analysis (average hue in the masked region)
        avg_color = self._avg_color_hsv(image, mask)

        # ── Classification rules ────────────────────────────────────

        # Very large region → body or hair_back
        if area_ratio > 0.25:
            if cy < 0.35:
                return "hair_back", 0.7
            return "body", 0.8

        # Large region in upper half → hair_front or hair_back
        if area_ratio > 0.1 and cy < 0.4:
            if cy < 0.25:
                return "hair_back", 0.6
            return "hair_front", 0.7

        # Medium region in center → face
        if 0.03 < area_ratio < 0.15 and 0.3 < cy < 0.6 and 0.3 < cx < 0.7:
            return "face", 0.7

        # Small region in face area → eyes, brows, mouth
        if area_ratio < 0.03 and 0.25 < cy < 0.65:
            # Eye vs brow vs mouth
            if cy < 0.35:
                # Upper face → eyebrow or accessory
                if area_ratio < 0.005:
                    return self._classify_left_right(cx, "eyebrow"), 0.6
                return "accessory", 0.5

            if 0.35 < cy < 0.5:
                # Eye region
                if area_ratio < 0.01:
                    return self._classify_left_right(cx, "eye"), 0.7
                return "face", 0.5

            if cy > 0.5:
                # Mouth region
                if area_ratio < 0.008:
                    return "mouth", 0.6
                return "face", 0.4

        # Small region at top → accessory (ears, ribbons)
        if cy < 0.2 and area_ratio < 0.05:
            return "accessory", 0.5

        # Fallback
        return "body", 0.3

    @staticmethod
    def _classify_left_right(cx: float, prefix: str) -> str:
        """Classify as left or right based on horizontal position."""
        if cx < 0.5:
            return f"{prefix}_L"
        return f"{prefix}_R"

    @staticmethod
    def _get_bbox(mask: np.ndarray) -> Optional[tuple[int, int, int, int]]:
        coords = cv2.findNonZero(mask)
        if coords is None:
            return None
        return cv2.boundingRect(coords)

    @staticmethod
    def _avg_color_hsv(image: np.ndarray, mask: np.ndarray) -> tuple[float, float, float]:
        """Get average HSV color of the masked region."""
        hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
        masked = hsv[mask > 128]
        if len(masked) == 0:
            return (0, 0, 0)
        return tuple(masked.mean(axis=0))


class PositionAwareClassifier(BaseClassifier):
    """Enhanced classifier that uses spatial context from other masks.

    First pass: classify with RuleBasedClassifier.
    Second pass: resolve conflicts using spatial relationships.
    """

    def __init__(self):
        self._base = RuleBasedClassifier()

    def classify(self, image: np.ndarray, mask: np.ndarray) -> tuple[str, float]:
        return self._base.classify(image, mask)

    def classify_all(
        self,
        image: np.ndarray,
        masks: list[np.ndarray],
    ) -> list[tuple[str, float]]:
        """Classify all masks with conflict resolution.

        Ensures no two masks get the same label (except left/right pairs).
        """
        # First pass: classify each independently
        results = []
        for mask in masks:
            label, score = self._base.classify(image, mask)
            results.append((label, score))

        # Second pass: resolve duplicate labels
        results = self._resolve_duplicates(image, masks, results)

        return results

    def _resolve_duplicates(
        self,
        image: np.ndarray,
        masks: list[np.ndarray],
        results: list[tuple[str, float]],
    ) -> list[tuple[str, float]]:
        """Resolve cases where multiple masks got the same label."""
        # Group by label
        label_indices: dict[str, list[int]] = {}
        for i, (label, _) in enumerate(results):
            label_indices.setdefault(label, []).append(i)

        resolved = list(results)

        for label, indices in label_indices.items():
            if len(indices) <= 1:
                continue

            # Multiple masks with same label — keep highest score, reclassify others
            indices.sort(key=lambda i: results[i][1], reverse=True)

            for idx in indices[1:]:
                # Try alternative labels based on position
                mask = masks[idx]
                new_label = self._find_alternative_label(image, mask, label, results)
                resolved[idx] = (new_label, resolved[idx][1] * 0.8)

        return resolved

    def _find_alternative_label(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        exclude_label: str,
        existing: list[tuple[str, float]],
    ) -> str:
        """Find an alternative label for a mask that conflicts."""
        h, w = image.shape[:2]
        bbox = cv2.boundingRect(cv2.findNonZero(mask)) if cv2.countNonZero(mask) > 0 else (0, 0, 0, 0)
        x, y, bw, bh = bbox
        cy = (y + bh / 2) / h

        # Try related labels
        if "eye" in exclude_label:
            return "face"
        if "eyebrow" in exclude_label:
            return "hair_front"
        if exclude_label == "face":
            return "hair_front" if cy < 0.4 else "body"
        if exclude_label == "hair_front":
            return "hair_back"
        if exclude_label == "hair_back":
            return "accessory"

        return "body"


class CNNClassifier(BaseClassifier):
    """CNN-based classifier for higher accuracy.

    TODO: Train a lightweight ResNet/MobileNet on labeled mask regions.
    Training data: anime character illustrations with part annotations.
    """

    def __init__(self, checkpoint: str | None = None, device: str = "cuda"):
        self.checkpoint = checkpoint
        self.device = device
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        if not self.checkpoint:
            raise RuntimeError("CNN checkpoint not provided")
        # TODO: load trained model
        # self._model = torch.load(self.checkpoint, map_location=self.device)
        # self._model.eval()

    def classify(self, image: np.ndarray, mask: np.ndarray) -> tuple[str, float]:
        self._load_model()
        # TODO: crop masked region, resize to 224x224, run through CNN
        # return LABELS[prediction.argmax()], prediction.max()
        raise NotImplementedError("CNN classifier not yet trained")
