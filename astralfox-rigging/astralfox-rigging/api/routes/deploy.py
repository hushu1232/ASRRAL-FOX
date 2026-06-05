"""One-click deploy to AstralFox route."""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from api.schemas import DeployRequest, DeployResponse
from deploy.deployer import AstralFoxDeployer

router = APIRouter()

_deployer: AstralFoxDeployer | None = None


def _get_deployer() -> AstralFoxDeployer:
    global _deployer
    if _deployer is None:
        _deployer = AstralFoxDeployer()
    return _deployer


@router.post("/", response_model=DeployResponse)
async def deploy_model(req: DeployRequest) -> DeployResponse:
    """Deploy an exported model to AstralFox desktop pet."""
    t0 = time.perf_counter()

    deployer = _get_deployer()

    try:
        result = deployer.deploy(
            model_id=req.model_id,
            anim_params=req.anim_params,
            target_name=req.target_name,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    elapsed = (time.perf_counter() - t0) * 1000
    return DeployResponse(
        model_id=req.model_id,
        deployed_path=result.deployed_path,
        reload_triggered=result.reload_triggered,
        configs_written=result.configs_written,
        processing_time_ms=round(elapsed, 1),
    )
