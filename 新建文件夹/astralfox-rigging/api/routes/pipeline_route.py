"""Pipeline orchestration endpoint."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas import PipelineRequest, PipelineResponse
from core.pipeline import run_pipeline

router = APIRouter(tags=["pipeline"])


@router.post("/pipeline", response_model=PipelineResponse)
async def run_full_pipeline(body: PipelineRequest):
    try:
        result = run_pipeline(
            image_id=body.image_id,
            template=body.template,
            mesh_density=body.mesh_density,
            auto_deploy=body.auto_deploy,
            target_name=body.target_name,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise HTTPException(500, f"Pipeline failed: {e}")

    return PipelineResponse(**result)
