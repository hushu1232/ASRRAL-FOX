"""Pipeline error types and diagnostic utilities.

Provides:
- Specific error types for each pipeline stage
- Image diagnostic checks before processing
- User-friendly error messages
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image


class ErrorCode(str, Enum):
    """Error codes for pipeline failures."""
    # Image errors
    IMAGE_NOT_FOUND = "IMAGE_NOT_FOUND"
    IMAGE_FORMAT_INVALID = "IMAGE_FORMAT_INVALID"
    IMAGE_TOO_SMALL = "IMAGE_TOO_SMALL"
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
    IMAGE_CORRUPTED = "IMAGE_CORRUPTED"

    # Separation errors
    NO_FOREGROUND = "NO_FOREGROUND"
    SEPARATION_FAILED = "SEPARATION_FAILED"
    LAYERS_TOO_FEW = "LAYERS_TOO_FEW"
    MASK_TOO_SMALL = "MASK_TOO_SMALL"

    # Rigging errors
    RIGGING_FAILED = "RIGGING_FAILED"
    MESH_GENERATION_FAILED = "MESH_GENERATION_FAILED"
    WEIGHT_PAINTING_FAILED = "WEIGHT_PAINTING_FAILED"

    # Export errors
    EXPORT_FAILED = "EXPORT_FAILED"
    MOC3_ENCODE_FAILED = "MOC3_ENCODE_FAILED"

    # Deploy errors
    DEPLOY_FAILED = "DEPLOY_FAILED"
    UNITY_NOT_CONNECTED = "UNITY_NOT_CONNECTED"

    # Generic
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


@dataclass
class PipelineException(Exception):
    """Base exception for pipeline errors."""
    code: ErrorCode
    message: str
    detail: Optional[str] = None
    recoverable: bool = True

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"

    def to_dict(self) -> dict:
        return {
            "error_code": self.code.value,
            "message": self.message,
            "detail": self.detail,
            "recoverable": self.recoverable,
        }


class ImageError(PipelineException):
    """Image-related errors."""
    pass


class SeparationError(PipelineException):
    """Layer separation errors."""
    pass


class RiggingError(PipelineException):
    """Rigging errors."""
    pass


class ExportError(PipelineException):
    """Export errors."""
    pass


class DeployError(PipelineException):
    """Deployment errors."""
    pass


# ── User-friendly error messages ─────────────────────────────────

ERROR_MESSAGES = {
    ErrorCode.IMAGE_NOT_FOUND: "找不到上传的图片，请重新上传。",
    ErrorCode.IMAGE_FORMAT_INVALID: "图片格式不支持，请使用 PNG 或 JPG 格式。",
    ErrorCode.IMAGE_TOO_SMALL: "图片尺寸太小，建议使用至少 512x512 像素的图片。",
    ErrorCode.IMAGE_TOO_LARGE: "图片尺寸太大，建议使用 4096x4096 以内的图片。",
    ErrorCode.IMAGE_CORRUPTED: "图片文件已损坏，请检查后重新上传。",

    ErrorCode.NO_FOREGROUND: "未检测到前景人物，请确保图片中有清晰的角色。",
    ErrorCode.SEPARATION_FAILED: "图层分离失败，可能是图片质量不佳或背景过于复杂。",
    ErrorCode.LAYERS_TOO_FEW: "分离出的图层太少，无法进行有效绑定。",
    ErrorCode.MASK_TOO_SMALL: "某些图层的区域太小，已自动跳过。",

    ErrorCode.RIGGING_FAILED: "骨骼绑定失败，请检查图片是否适合绑定。",
    ErrorCode.MESH_GENERATION_FAILED: "网格生成失败，已使用默认网格。",
    ErrorCode.WEIGHT_PAINTING_FAILED: "权重绘制失败，已使用默认权重。",

    ErrorCode.EXPORT_FAILED: "模型导出失败，请重试。",
    ErrorCode.MOC3_ENCODE_FAILED: "moc3 编码失败，已跳过该格式。",

    ErrorCode.DEPLOY_FAILED: "部署失败，请检查 Unity 项目路径是否正确。",
    ErrorCode.UNITY_NOT_CONNECTED: "无法连接到 Unity，请确保 Unity 项目正在运行。",

    ErrorCode.UNKNOWN_ERROR: "发生未知错误，请重试。",
}


def get_user_message(code: ErrorCode) -> str:
    """Get user-friendly error message."""
    return ERROR_MESSAGES.get(code, ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR])


# ── Image Diagnostics ────────────────────────────────────────────

@dataclass
class DiagnosticResult:
    """Result of image diagnostic check."""
    passed: bool
    error_code: Optional[ErrorCode] = None
    message: str = ""
    warnings: list[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def diagnose_image(image_path: str | Path) -> DiagnosticResult:
    """Run diagnostic checks on an image before processing.

    Checks:
    1. File exists and is readable
    2. Valid image format
    3. Reasonable dimensions
    4. Has detectable foreground

    Args:
        image_path: Path to the image file.

    Returns:
        DiagnosticResult with pass/fail status and details.
    """
    path = Path(image_path)

    # Check file exists
    if not path.exists():
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_NOT_FOUND,
            message="Image file not found",
        )

    # Check file size
    file_size = path.stat().st_size
    if file_size == 0:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_CORRUPTED,
            message="Image file is empty",
        )

    if file_size > 50 * 1024 * 1024:  # 50MB
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_TOO_LARGE,
            message="Image file is too large (>50MB)",
        )

    # Try to open and validate image
    try:
        img = Image.open(path)
        img.verify()  # Verify it's a valid image
        img = Image.open(path)  # Re-open after verify
    except Exception as e:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_CORRUPTED,
            message=f"Cannot open image: {e}",
        )

    # Check format
    if img.format not in ("PNG", "JPEG", "JPG", "WEBP"):
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_FORMAT_INVALID,
            message=f"Unsupported format: {img.format}",
        )

    # Check dimensions
    width, height = img.size
    warnings = []

    if width < 256 or height < 256:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.IMAGE_TOO_SMALL,
            message=f"Image too small: {width}x{height}",
        )

    if width < 512 or height < 512:
        warnings.append(f"Image is small ({width}x{height}), results may be suboptimal")

    if width > 4096 or height > 4096:
        warnings.append(f"Image is very large ({width}x{height}), processing may be slow")

    # Check if image has alpha channel
    if img.mode == "RGBA":
        alpha = np.array(img)[:, :, 3]
        if np.mean(alpha) < 10:
            return DiagnosticResult(
                passed=False,
                error_code=ErrorCode.NO_FOREGROUND,
                message="Image appears to be mostly transparent",
            )

    # Convert to numpy for further checks
    img_array = np.array(img.convert("RGB"))

    # Check if image is not just a single color
    if np.std(img_array) < 10:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.NO_FOREGROUND,
            message="Image appears to be a single color",
        )

    # Quick foreground detection check
    try:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return DiagnosticResult(
                passed=False,
                error_code=ErrorCode.NO_FOREGROUND,
                message="No foreground detected in image",
            )

        # Check if largest contour is too small
        largest_area = max(cv2.contourArea(c) for c in contours)
        total_area = width * height
        foreground_ratio = largest_area / total_area

        if foreground_ratio < 0.05:
            return DiagnosticResult(
                passed=False,
                error_code=ErrorCode.NO_FOREGROUND,
                message=f"Foreground too small: {foreground_ratio:.1%} of image",
            )

        if foreground_ratio < 0.1:
            warnings.append(f"Foreground is small ({foreground_ratio:.1%}), may affect quality")

    except Exception:
        # Foreground check failed, but don't block processing
        warnings.append("Could not verify foreground detection")

    return DiagnosticResult(
        passed=True,
        warnings=warnings,
    )


def diagnose_mask(mask: np.ndarray, min_area: int = 100) -> DiagnosticResult:
    """Check if a mask is valid for rigging.

    Args:
        mask: Binary mask array.
        min_area: Minimum area in pixels.

    Returns:
        DiagnosticResult with pass/fail status.
    """
    if mask is None or mask.size == 0:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.MASK_TOO_SMALL,
            message="Mask is empty",
        )

    area = np.sum(mask > 128)

    if area < min_area:
        return DiagnosticResult(
            passed=False,
            error_code=ErrorCode.MASK_TOO_SMALL,
            message=f"Mask area too small: {area} < {min_area}",
        )

    return DiagnosticResult(passed=True)
