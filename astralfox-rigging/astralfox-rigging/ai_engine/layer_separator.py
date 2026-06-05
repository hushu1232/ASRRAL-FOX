"""AI-powered layer separation: one image → labeled Live2D layers.

Pipeline:
    1. Generate candidate masks (SAM2 or rembg fallback)
    2. Classify each mask by semantic label
    3. Merge/split into target layers
    4. Refine edges (alpha matting)
    5. Inpaint occluded regions
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image


@dataclass
class SeparatedLayer:
    """A single separated layer with its texture and mask."""
    label: str
    texture: np.ndarray          # RGBA, same size as original
    mask: np.ndarray             # uint8 alpha mask
    bbox: list[int] = field(default_factory=list)  # [x, y, w, h]
    score: float = 1.0           # confidence score

    def save_texture(self, path: str | Path) -> None:
        Image.fromarray(self.texture).save(str(path))

    def save_mask(self, path: str | Path) -> None:
        Image.fromarray(self.mask, mode="L").save(str(path))

    @property
    def area(self) -> int:
        return int(np.sum(self.mask > 128))


# ── Utility functions ──────────────────────────────────────────────

def get_bbox(mask: np.ndarray) -> list[int]:
    """Get bounding box [x, y, w, h] of non-zero region."""
    coords = cv2.findNonZero(mask)
    if coords is None:
        return [0, 0, 0, 0]
    x, y, w, h = cv2.boundingRect(coords)
    return [x, y, w, h]


def mask_to_texture(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Apply mask to image to create RGBA texture."""
    h, w = image.shape[:2]
    if image.shape[2] == 3:
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        rgba[:, :, :3] = image
        rgba[:, :, 3] = mask
        return rgba
    result = image.copy()
    result[:, :, 3] = mask
    return result


# ── SimpleLayerSeparator (rembg fallback, no GPU) ──────────────────

class SimpleLayerSeparator:
    """Fallback separator using rembg (no GPU required).

    Extracts foreground as a single "body" layer.
    Good enough for prototyping; use SmartLayerSeparator for production.

    Args:
        model_path: Path to a local .onnx model file. If provided, loads from
            local file instead of downloading. Supports u2net, u2netp, isnet-anime, etc.
    """

    def __init__(self, model_path: str | None = None):
        self._model_path = model_path
        self._model_name = "u2net"
        self._session = None

    def _get_session(self):
        if self._session is not None:
            return self._session
        from rembg import new_session
        if self._model_path and Path(self._model_path).exists():
            import os
            model_dir = str(Path(self._model_path).resolve().parent)
            os.environ["U2NET_HOME"] = model_dir
            self._model_name = Path(self._model_path).stem
        elif self._model_path:
            import logging
            logging.getLogger(__name__).warning(
                f"Local model not found at {self._model_path}, falling back to auto-download"
            )
        self._session = new_session(model_name=self._model_name)
        return self._session

    def separate(
        self,
        image_path: str | Path,
        target_labels: Optional[list[str]] = None,
        edge_refine: bool = True,
    ) -> list[SeparatedLayer]:
        """Separate image using rembg (foreground extraction only)."""
        try:
            from rembg import remove
        except ImportError:
            raise RuntimeError("rembg not installed: pip install rembg")

        img = np.array(Image.open(image_path).convert("RGBA"))

        # Remove background using local model or auto-download
        session = self._get_session()
        fg = remove(Image.fromarray(img), session=session)
        fg_arr = np.array(fg)

        # Extract alpha channel as mask
        alpha = fg_arr[:, :, 3]

        # Clean up mask with morphological operations
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
        alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)

        # Create texture
        texture = mask_to_texture(img[:, :, :3], alpha)
        bbox = get_bbox(alpha)

        return [
            SeparatedLayer(
                label="body",
                texture=texture,
                mask=alpha,
                bbox=bbox,
                score=0.8,
            )
        ]


# ── SmartLayerSeparator (SAM2 + classifier) ───────────────────────

class SmartLayerSeparator:
    """Full AI separation pipeline using SAM2 + semantic classifier.

    Pipeline:
        1. SAM2 automatic mask generator → candidate masks
        2. Semantic classifier → label each mask
        3. Merge/split by label into target layers
        4. Refine edges with alpha matting
        5. Inpaint occluded regions
    """

    LAYER_ORDER = [
        "hair_back", "body", "hair_front", "face",
        "eye_L", "eye_R", "eyebrow_L", "eyebrow_R",
        "mouth", "accessory",
    ]

    def __init__(self, device: str = "cuda", sam2_checkpoint: str | None = None):
        self.device = device
        self.sam2_checkpoint = sam2_checkpoint
        self._sam2 = None
        self._classifier = None

    def _load_sam2(self):
        if self._sam2 is not None:
            return
        try:
            from sam2.build_sam import build_sam2
            from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
            checkpoint = self.sam2_checkpoint or "sam2_vit_h.pt"
            model = build_sam2(checkpoint, device=self.device)
            self._sam2 = SAM2AutomaticMaskGenerator(model)
        except ImportError:
            raise RuntimeError("sam2 not installed: pip install sam2")

    def _load_classifier(self):
        if self._classifier is None:
            from ai_engine.semantic_classifier import RuleBasedClassifier
            self._classifier = RuleBasedClassifier()

    def separate(
        self,
        image_path: str | Path,
        target_labels: Optional[list[str]] = None,
        edge_refine: bool = True,
    ) -> list[SeparatedLayer]:
        """Run the full AI separation pipeline."""
        image = np.array(Image.open(image_path).convert("RGBA"))
        rgb = image[:, :, :3]

        if target_labels is None:
            target_labels = self.LAYER_ORDER

        # Step 1: Generate candidate masks
        masks = self._generate_masks(rgb)

        # Step 2: Classify each mask
        classified = self._classify_masks(rgb, masks)

        # Step 3: Merge into target layers
        layers = self._merge_to_layers(rgb, classified, target_labels)

        # Step 4: Refine edges
        if edge_refine:
            for layer in layers:
                layer.mask = self._refine_mask(layer.mask)
                layer.texture = mask_to_texture(rgb, layer.mask)
                layer.bbox = get_bbox(layer.mask)

        # Step 5: Inpaint occluded regions
        layers = self._inpaint_all(rgb, layers)

        return layers

    def _generate_masks(self, image: np.ndarray) -> list[dict]:
        """Generate candidate masks using SAM2."""
        self._load_sam2()
        masks = self._sam2.generate(image)
        # Each mask dict has: segmentation (H,W bool), area, bbox, predicted_iou
        return masks

    def _classify_masks(
        self, image: np.ndarray, masks: list[dict]
    ) -> list[tuple[str, np.ndarray, float]]:
        """Classify each mask into a semantic label."""
        self._load_classifier()
        h, w = image.shape[:2]
        classified = []
        for m in masks:
            mask = (m["segmentation"].astype(np.uint8) * 255)
            label, score = self._classifier.classify(image, mask)
            classified.append((label, mask, score))
        return classified

    def _merge_to_layers(
        self,
        image: np.ndarray,
        classified: list[tuple[str, np.ndarray, float]],
        target_labels: list[str],
    ) -> list[SeparatedLayer]:
        """Merge classified masks into target layer set."""
        h, w = image.shape[:2]

        # Group masks by label
        label_masks: dict[str, list[tuple[np.ndarray, float]]] = {}
        for label, mask, score in classified:
            if label in target_labels:
                label_masks.setdefault(label, []).append((mask, score))

        # For each target label, pick the best mask or merge
        layers = []
        for label in target_labels:
            if label not in label_masks:
                continue

            candidates = label_masks[label]
            if len(candidates) == 1:
                best_mask, score = candidates[0]
            else:
                # Pick the mask with highest score
                candidates.sort(key=lambda x: x[1], reverse=True)
                best_mask, score = candidates[0]

            # For left/right pairs, try to split if needed
            if label in ("eye_L", "eye_R", "eyebrow_L", "eyebrow_R"):
                best_mask = self._split_lateral(image, best_mask, label)

            texture = mask_to_texture(image[:, :, :3], best_mask)
            bbox = get_bbox(best_mask)

            layers.append(SeparatedLayer(
                label=label,
                texture=texture,
                mask=best_mask,
                bbox=bbox,
                score=score,
            ))

        return layers

    def _split_lateral(
        self, image: np.ndarray, mask: np.ndarray, label: str
    ) -> np.ndarray:
        """Split a mask that covers both sides into left or right half."""
        h, w = mask.shape[:2]
        center_x = w // 2

        # Find the actual centroid of the mask
        coords = cv2.findNonZero(mask)
        if coords is None:
            return mask
        cx = coords[:, :, 0].mean()

        # If mask is already on the correct side, return as-is
        if "L" in label and cx < center_x:
            return mask
        if "R" in label and cx > center_x:
            return mask

        # Split: keep left half or right half
        result = mask.copy()
        if "L" in label:
            result[:, center_x:] = 0
        else:
            result[:, :center_x] = 0

        return result

    def _refine_mask(self, mask: np.ndarray) -> np.ndarray:
        """Refine mask edges with morphological smoothing."""
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        refined = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        refined = cv2.GaussianBlur(refined, (3, 3), 0)
        return refined

    def _inpaint_all(
        self, image: np.ndarray, layers: list[SeparatedLayer]
    ) -> list[SeparatedLayer]:
        """Inpaint occluded regions for each layer.

        For back layers (e.g., face), fill in pixels that are covered
        by front layers (e.g., hair) so the texture is complete.
        """
        rgb = image[:, :, :3]
        h, w = rgb.shape[:2]

        # Build occlusion map from all front layers
        all_masks = np.zeros((h, w), dtype=np.uint8)
        for layer in layers:
            all_masks = cv2.bitwise_or(all_masks, layer.mask)

        for layer in layers:
            # Find pixels that are part of this layer but occluded by front layers
            own_mask = layer.mask
            others_mask = cv2.bitwise_and(all_masks, cv2.bitwise_not(own_mask))

            # Dilate the occlusion mask slightly
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            occluded = cv2.dilate(others_mask, kernel, iterations=2)

            # Pixels to inpaint: inside own mask but occluded
            inpaint_mask = cv2.bitwise_and(own_mask, occluded)

            if np.sum(inpaint_mask) > 100:
                # Inpaint
                inpainted = cv2.inpaint(rgb, inpaint_mask, 10, cv2.INPAINT_TELEA)
                texture = mask_to_texture(inpainted, own_mask)
                layer.texture = texture

        return layers


# ── MobileSAM Separator ──────────────────────────────────────────────

class MobileSAMSeparator:
    """Multi-layer separator using MobileSAM (40MB) + position heuristics.

    Uses a grid of single-point prompts to segment the image into regions,
    then classifies each region by vertical position. Much lighter than SAM2
    (40MB vs 2.4GB) and CPU-friendly.

    Args:
        checkpoint: Path to mobile_sam.pt (38.8MB).
        grid_size: Point grid density (7 = 49 points, ~28s CPU; 8 = 64 points, ~35s).
        nms_iou_thresh: IoU threshold for deduplication (0.6-0.7 recommended).
    """

    LAYER_ORDER = [
        "hair_back", "body", "hair_front", "face",
        "eye_L", "eye_R", "eyebrow_L", "eyebrow_R",
        "mouth", "accessory",
    ]

    def __init__(
        self,
        checkpoint: str = "models/mobile_sam.pt",
        grid_size: int = 7,
        nms_iou_thresh: float = 0.6,
    ):
        self._checkpoint = checkpoint
        self._grid_size = grid_size
        self._nms_thresh = nms_iou_thresh
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        from ultralytics import SAM
        self._model = SAM(self._checkpoint)

    def separate(
        self,
        image_path: str | Path,
        target_labels: Optional[list[str]] = None,
        edge_refine: bool = True,
    ) -> list[SeparatedLayer]:
        import time, logging
        logger = logging.getLogger(__name__)
        image = np.array(Image.open(image_path).convert("RGBA"))
        rgb = image[:, :, :3]
        h, w = rgb.shape[:2]

        if target_labels is None:
            target_labels = self.LAYER_ORDER

        self._load_model()
        grid = self._grid_size

        # Generate masks via grid point sampling
        raw_masks = []
        t0 = time.perf_counter()
        for i in range(grid):
            for j in range(grid):
                x = int(w * (i + 0.5) / grid)
                y = int(h * (j + 0.5) / grid)
                r = self._model(rgb, points=[[[x, y]]], labels=[[1]])
                mask = r[0].masks.data[0].cpu().numpy().astype(np.uint8)
                mask = (mask * 255).astype(np.uint8) if mask.max() <= 1 else mask
                area = int(np.sum(mask > 128))
                if area > 500:
                    raw_masks.append({"mask": mask, "area": area, "cx": x, "cy": y})
        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(f"MobileSAM: {grid}x{grid} grid → {len(raw_masks)} masks in {elapsed:.0f}ms")

        # NMS deduplication
        unique = self._nms(raw_masks, self._nms_thresh)
        logger.info(f"MobileSAM: after NMS → {len(unique)} masks")

        # Classify by position
        layers = []
        for m in unique:
            label = self._classify_mask(m["cy"], h, m["cx"], w)
            # Edge refine
            mask = m["mask"]
            if edge_refine:
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
            texture = mask_to_texture(rgb, mask)
            bbox = get_bbox(mask)
            layers.append(SeparatedLayer(
                label=label, texture=texture, mask=mask, bbox=bbox, score=0.85,
            ))

        # Merge duplicate labels (keep largest)
        merged: dict[str, SeparatedLayer] = {}
        for layer in layers:
            if layer.label not in merged or layer.area > merged[layer.label].area:
                merged[layer.label] = layer

        # Sort by layer order
        result = [merged[l] for l in target_labels if l in merged]
        return result

    def _classify_mask(self, cy: int, h: int, cx: int, w: int) -> str:
        """Classify mask by vertical position heuristics."""
        y_rel = cy / h
        x_rel = cx / w
        if y_rel < 0.15:
            return "hair_back"
        if y_rel < 0.25:
            return "hair_front"
        if y_rel < 0.45:
            return "face" if 0.3 < x_rel < 0.7 else "eyebrow_L" if x_rel < 0.5 else "eyebrow_R"
        if y_rel < 0.55:
            return "body"
        if y_rel < 0.70:
            return "body"
        return "accessory"

    @staticmethod
    def _nms(masks: list[dict], iou_thresh: float) -> list[dict]:
        idxs = sorted(range(len(masks)), key=lambda i: masks[i]["area"], reverse=True)
        keep = []
        while idxs:
            i = idxs.pop(0)
            keep.append(i)
            idxs = [j for j in idxs if MobileSAMSeparator._iou(
                masks[i]["mask"], masks[j]["mask"]) < iou_thresh]
        return [masks[i] for i in keep]

    @staticmethod
    def _iou(a: np.ndarray, b: np.ndarray) -> float:
        inter = np.logical_and(a > 128, b > 128).sum()
        union = np.logical_or(a > 128, b > 128).sum()
        return inter / union if union > 0 else 0.0


# ── Factory ────────────────────────────────────────────────────────

def create_separator(
    backend: str = "auto",
    device: str = "cuda",
    sam2_checkpoint: str | None = None,
    rembg_model_path: str | None = None,
    mobilesam_checkpoint: str | None = None,
) -> SimpleLayerSeparator | SmartLayerSeparator | MobileSAMSeparator:
    """Create the appropriate separator based on available dependencies.

    Args:
        backend: "simple" (rembg), "smart" (SAM2), "mobilesam" (MobileSAM),
            or "auto" (try MobileSAM → SAM2 → rembg fallback).
        device: "cuda" or "cpu".
        sam2_checkpoint: Path to SAM2 checkpoint file.
        rembg_model_path: Path to local .onnx model for rembg.
        mobilesam_checkpoint: Path to mobile_sam.pt for MobileSAM.
    """
    if backend == "simple":
        return SimpleLayerSeparator(model_path=rembg_model_path)

    if backend == "smart":
        return SmartLayerSeparator(device=device, sam2_checkpoint=sam2_checkpoint)

    if backend == "mobilesam":
        return MobileSAMSeparator(
            checkpoint=mobilesam_checkpoint or "models/mobile_sam.pt",
        )

    # auto: try MobileSAM → SAM2 → rembg
    try:
        import ultralytics
        ckpt = mobilesam_checkpoint or "models/mobile_sam.pt"
        if Path(ckpt).exists():
            return MobileSAMSeparator(checkpoint=ckpt)
    except ImportError:
        pass

    try:
        import sam2
        return SmartLayerSeparator(device=device, sam2_checkpoint=sam2_checkpoint)
    except ImportError:
        return SimpleLayerSeparator(model_path=rembg_model_path)
