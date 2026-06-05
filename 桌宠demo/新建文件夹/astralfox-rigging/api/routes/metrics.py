"""Prometheus-style metrics endpoint with GPU stats."""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from core.gpu_monitor import get_gpu_metrics, refresh_metrics
from core.inference import get_inference_engine

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_class=PlainTextResponse)
async def get_metrics():
    engine = get_inference_engine()
    m = refresh_metrics()

    lines = [
        "# HELP astralfox_rigging_up Rigging service health (1=up)",
        "# TYPE astralfox_rigging_up gauge",
        "astralfox_rigging_up 1",
        "",
        "# HELP rigging_gpu_available GPU available (1=yes)",
        "# TYPE rigging_gpu_available gauge",
        f"rigging_gpu_available {1 if m['gpu_available'] else 0}",
        "",
        "# HELP rigging_gpu_memory_used_mb GPU memory used in MB",
        "# TYPE rigging_gpu_memory_used_mb gauge",
        f"rigging_gpu_memory_used_mb {m['gpu_memory_used_mb']}",
        "",
        "# HELP rigging_gpu_memory_total_mb GPU memory total in MB",
        "# TYPE rigging_gpu_memory_total_mb gauge",
        f"rigging_gpu_memory_total_mb {m['gpu_memory_total_mb']}",
        "",
        "# HELP rigging_gpu_utilization_pct GPU utilization percentage",
        "# TYPE rigging_gpu_utilization_pct gauge",
        f"rigging_gpu_utilization_pct {m['gpu_utilization_pct']}",
        "",
        "# HELP rigging_inference_count_total Total inference count",
        "# TYPE rigging_inference_count_total counter",
        f"rigging_inference_count_total {m['inference_count']}",
        "",
        "# HELP rigging_inference_duration_ms_avg Average inference duration in ms",
        "# TYPE rigging_inference_duration_ms_avg gauge",
        f"rigging_inference_duration_ms_avg {m['avg_inference_ms']}",
        "",
        "# HELP rigging_provider_info Inference provider (directml/cuda/cpu)",
        "# TYPE rigging_provider_info gauge",
        f'rigging_provider_info{{provider="{m["provider"]}"}} 1',
        "",
    ]

    return PlainTextResponse("\n".join(lines), media_type="text/plain")
