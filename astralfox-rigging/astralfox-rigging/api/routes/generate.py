"""Image generation API route using ComfyUI.

Provides /api/generate endpoint for converting character images
to anatomical standard standing pose.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ai_engine.image_generator import (
    ComfyUIError,
    ComfyUIImageGenerator,
    ComfyUITimeoutError,
    ComfyUIUploadError,
    ComfyUIExecutionError,
)

router = APIRouter(prefix="/api", tags=["generate"])
logger = logging.getLogger(__name__)


class GenerateResponse(BaseModel):
    """Response model for image generation."""
    image_url: str  # e.g., /output/uploads/xxx.png
    filename: str


@router.post("/generate", response_model=GenerateResponse)
async def generate_anatomical_pose(
    image: UploadFile = File(..., description="Character image to convert"),
    prompt: str = Form("", description="Additional positive prompt"),
    negative_prompt: str = Form("", description="Override negative prompt"),
    seed: int = Form(-1, description="Random seed (-1 for random)"),
) -> GenerateResponse:
    """Generate anatomical standing pose from character image.

    Converts the uploaded character image to a strictly symmetrical
    anatomical standard standing pose using ComfyUI img2img.

    Args:
        image: Character image file (PNG/JPG).
        prompt: Additional description to append to default prompt.
        negative_prompt: Override default negative prompt.
        seed: Random seed for reproducibility (-1 for random).

    Returns:
        GenerateResponse with image_url and filename.
    """
    # Validate file type
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an image (PNG/JPG)."
        )

    # Create temp directory for uploaded file
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)

    # Save uploaded file to temp
    temp_filename = f"upload_{uuid.uuid4().hex[:12]}.png"
    temp_path = temp_dir / temp_filename

    try:
        # Save upload to temp file
        with open(temp_path, "wb") as f:
            content = await image.read()
            f.write(content)

        logger.info(f"Saved upload to: {temp_path}")

        # Initialize ComfyUI generator
        generator = ComfyUIImageGenerator.from_config()

        # Generate anatomical pose
        output_dir = Path("output/uploads")
        result_path = generator.generate_anatomical_standpose(
            image_path=temp_path,
            prompt=prompt,
            negative_prompt=negative_prompt,
            workflow_template_path="templates/comfyui_workflow_img2img.json",
            output_dir=output_dir,
            seed=seed,
        )

        # Build response
        filename = result_path.name
        image_url = f"/output/uploads/{filename}"

        logger.info(f"Generated image: {result_path}")

        # TODO: Integrate with pipeline when ready
        # from pipeline import process_image
        # process_image(str(result_path))

        return GenerateResponse(
            image_url=image_url,
            filename=filename,
        )

    except ComfyUIUploadError as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to upload image to ComfyUI: {e}"
        )
    except ComfyUITimeoutError as e:
        logger.error(f"Generation timeout: {e}")
        raise HTTPException(
            status_code=504,
            detail=f"Image generation timed out: {e}"
        )
    except ComfyUIExecutionError as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {e}"
        )
    except ComfyUIError as e:
        logger.error(f"ComfyUI error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"ComfyUI error: {e}"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {e}"
        )
    finally:
        # Cleanup temp file
        if temp_path.exists():
            try:
                temp_path.unlink()
                logger.debug(f"Cleaned up temp file: {temp_path}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file: {e}")
