"""End-to-end pipeline route: upload → separate → rig → export → deploy.

Includes diagnostic checks, fallback mechanisms, and error recovery.
"""

from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api.schemas import (
    PipelineRequest, PipelineResponse,
    SeparateRequest, RigRequest, ExportRequest, DeployRequest,
)
from api.errors import (
    ErrorCode, PipelineException, get_user_message, diagnose_image,
)
from api.routes.separate import separate_layers
from api.routes.rig import rig_model
from api.routes.export import export_model
from api.routes.deploy import deploy_model
from api.progress import report_progress

router = APIRouter()
logger = logging.getLogger(__name__)


def _cleanup_intermediates(image_id: str, stages_completed: list[str]) -> None:
    """Clean up intermediate files on pipeline failure.

    Args:
        image_id: The image ID being processed.
        stages_completed: List of stages that completed successfully.
    """
    output_dir = Path("output") / image_id

    # Always clean up layers if separation was done
    if "separate" in stages_completed:
        layers_dir = output_dir / "layers"
        if layers_dir.exists():
            shutil.rmtree(layers_dir, ignore_errors=True)
            logger.info(f"Cleaned up layers for {image_id}")

    # Clean up cubism export if export was done
    if "export" in stages_completed:
        cubism_dir = output_dir / "cubism"
        if cubism_dir.exists():
            shutil.rmtree(cubism_dir, ignore_errors=True)
            logger.info(f"Cleaned up cubism export for {image_id}")

    # Remove the output directory if empty
    if output_dir.exists() and not any(output_dir.iterdir()):
        output_dir.rmdir()
        logger.info(f"Removed empty output directory for {image_id}")


@router.post("/", response_model=PipelineResponse)
async def run_pipeline(req: PipelineRequest) -> PipelineResponse:
    """Run the full rigging pipeline end-to-end with diagnostic checks and error recovery.

    Features:
    - Image diagnostic checks before processing
    - Fallback mechanisms at each stage
    - User-friendly error messages
    - Automatic cleanup on failure
    """
    t0 = time.perf_counter()
    stages_completed: list[str] = []

    # Verify image exists and run diagnostics
    upload_dir = Path("output/uploads")
    image_matches = list(upload_dir.glob(f"{req.image_id}.*"))

    if not image_matches:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": ErrorCode.IMAGE_NOT_FOUND.value,
                "message": get_user_message(ErrorCode.IMAGE_NOT_FOUND),
            }
        )

    # Run image diagnostics
    diag = diagnose_image(image_matches[0])
    if not diag.passed:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": diag.error_code.value,
                "message": get_user_message(diag.error_code),
                "detail": diag.message,
            }
        )

    try:
        # Step 1: Separate (with fallback)
        report_progress(req.image_id, "separate", "started", 0.0, "正在分离图层...")
        sep_resp = await separate_layers(SeparateRequest(image_id=req.image_id))
        stages_completed.append("separate")
        report_progress(req.image_id, "separate", "completed", 0.25, f"分离出 {len(sep_resp.layers)} 个图层")

        # Step 2: Rig (with fallback)
        report_progress(req.image_id, "rig", "started", 0.25, "正在生成骨骼和网格...")
        rig_resp = await rig_model(RigRequest(
            image_id=req.image_id,
            layers=sep_resp.layers,
            template=req.template,
            mesh_density=req.mesh_density,
        ))
        stages_completed.append("rig")
        report_progress(req.image_id, "rig", "completed", 0.50, f"生成了 {rig_resp.mesh_count} 个网格")

        # Step 3: Export
        report_progress(req.image_id, "export", "started", 0.50, "正在导出模型...")
        export_resp = await export_model(ExportRequest(
            image_id=req.image_id,
            skeleton=rig_resp.skeleton,
            layers=sep_resp.layers,
            meshes=rig_resp.meshes,
            weights=rig_resp.weights,
        ))
        stages_completed.append("export")
        report_progress(req.image_id, "export", "completed", 0.75, "导出完成")

        # Step 4: Deploy (optional)
        deploy_resp = None
        if req.auto_deploy:
            report_progress(req.image_id, "deploy", "started", 0.75, "正在部署...")
            deploy_resp = await deploy_model(DeployRequest(
                model_id=req.image_id,
                target_name=req.target_name,
            ))
            stages_completed.append("deploy")
            report_progress(req.image_id, "deploy", "completed", 1.0, "部署完成")
        else:
            report_progress(req.image_id, "pipeline", "completed", 1.0, "处理完成")

    except PipelineException as e:
        # Handle known pipeline errors
        logger.error(f"Pipeline error at stage {len(stages_completed) + 1}: {e}")
        report_progress(req.image_id, stages_completed[-1] if stages_completed else "init", "failed", 0, str(e))
        _cleanup_intermediates(req.image_id, stages_completed)
        raise HTTPException(
            status_code=400,
            detail=e.to_dict(),
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error at stage {len(stages_completed) + 1}: {e}")
        report_progress(req.image_id, stages_completed[-1] if stages_completed else "init", "failed", 0, str(e))
        _cleanup_intermediates(req.image_id, stages_completed)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCode.UNKNOWN_ERROR.value,
                "message": get_user_message(ErrorCode.UNKNOWN_ERROR),
                "detail": str(e),
            }
        )

    total = (time.perf_counter() - t0) * 1000
    return PipelineResponse(
        separate=sep_resp,
        rig=rig_resp,
        export=export_resp,
        deploy=deploy_resp,
        total_time_ms=round(total, 1),
    )
