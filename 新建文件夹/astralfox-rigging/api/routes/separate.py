"""Layer separation endpoint."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas import SeparateRequest, SeparateResponse
from core.separation import separate_layers

router = APIRouter(tags=["separation"])


@router.post("/separate", response_model=SeparateResponse)
async def separate_image(body: SeparateRequest):
    try:
        result = separate_layers(
            image_id=body.image_id,
            target_layers=body.target_layers,
            edge_refine=body.edge_refine,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Separation failed: {e}")
        raise HTTPException(500, f"Separation failed: {e}")

    return SeparateResponse(**result)
