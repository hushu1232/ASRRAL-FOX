"""Rigging endpoint — skeleton + meshes + weights."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas import RigRequest, RigResponse
from core.rigging import rig_layers

router = APIRouter(tags=["rigging"])


@router.post("/rig", response_model=RigResponse)
async def rig_model(body: RigRequest):
    try:
        result = rig_layers(
            image_id=body.image_id,
            layers=body.layers,
            template=body.template,
            mesh_density=body.mesh_density,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Rigging failed: {e}")
        raise HTTPException(500, f"Rigging failed: {e}")

    return RigResponse(**result)
