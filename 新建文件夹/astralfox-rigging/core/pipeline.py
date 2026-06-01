"""Full pipeline orchestration — separate → rig → export → deploy."""

import time
from loguru import logger

from core.separation import separate_layers
from core.rigging import rig_layers
from core.export import export_model
from core.deploy import deploy_model


def run_pipeline(
    image_id: str,
    template: str = "catgirl",
    mesh_density: str = "medium",
    auto_deploy: bool = False,
    target_name: str | None = None,
) -> dict:
    """Run the full AI rigging pipeline.

    Stages:
    1. Layer separation (SAM2/CPU)
    2. Skeleton rigging + mesh generation + weight assignment
    3. Cubism SDK export (moc3, model3.json, cmo3)
    4. (Optional) Deploy to target directory
    """
    start = time.perf_counter()

    # Stage 1: Separate
    logger.info(f"pipeline [{image_id}]: stage 1/4 — separating layers")
    sep_result = separate_layers(image_id)
    layers = sep_result["layers"]

    # Build layer dicts for rigging
    layer_dicts = [{"label": ly["label"], "bbox": ly["bbox"]} for ly in layers]

    # Stage 2: Rig
    logger.info(f"pipeline [{image_id}]: stage 2/4 — rigging ({len(layers)} layers)")
    rig_result = rig_layers(image_id, layer_dicts, template, mesh_density)

    # Stage 3: Export
    logger.info(f"pipeline [{image_id}]: stage 3/4 — exporting Cubism model")
    export_result = export_model(
        image_id=image_id,
        skeleton=rig_result["skeleton"],
        layers=layers,
        meshes=rig_result["meshes"],
        weights=rig_result["weights"],
    )

    # Stage 4: Deploy (optional)
    deploy_result = None
    if auto_deploy:
        logger.info(f"pipeline [{image_id}]: stage 4/4 — deploying")
        deploy_result = deploy_model(image_id, target_name=target_name)

    total_ms = int((time.perf_counter() - start) * 1000)
    logger.info(f"pipeline [{image_id}]: complete in {total_ms}ms")

    return {
        "separate": sep_result,
        "rig": rig_result,
        "export": export_result,
        "deploy": deploy_result,
        "total_time_ms": total_ms,
    }
