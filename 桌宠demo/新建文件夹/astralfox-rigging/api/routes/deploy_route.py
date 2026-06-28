"""Deploy endpoint — copy model to the Alife runtime staging area."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas import DeployRequest, DeployResponse
from core.deploy import deploy_model

router = APIRouter(tags=["deploy"])


@router.post("/deploy", response_model=DeployResponse)
async def deploy_cubism_model(body: DeployRequest):
    try:
        result = deploy_model(
            model_id=body.model_id,
            anim_params=body.anim_params,
            target_name=body.target_name,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Deploy failed: {e}")
        raise HTTPException(500, f"Deploy failed: {e}")

    return DeployResponse(**result)
