"""GPU metrics collection — DirectML / CUDA / CPU."""

import time
from loguru import logger


class GpuMetrics:
    """Collected GPU / inference engine metrics."""

    def __init__(self):
        self.gpu_available = False
        self.gpu_name = "none"
        self.gpu_memory_total_mb = 0
        self.gpu_memory_used_mb = 0
        self.gpu_utilization_pct = 0.0
        self.provider = "cpu"
        self.inference_count = 0
        self.total_inference_ms = 0
        self.last_inference_ms = 0
        self.last_check = time.time()

    @property
    def avg_inference_ms(self) -> float:
        if self.inference_count == 0:
            return 0.0
        return self.total_inference_ms / self.inference_count

    def to_dict(self) -> dict:
        return {
            "gpu_available": self.gpu_available,
            "gpu_name": self.gpu_name,
            "gpu_memory_total_mb": self.gpu_memory_total_mb,
            "gpu_memory_used_mb": self.gpu_memory_used_mb,
            "gpu_utilization_pct": round(self.gpu_utilization_pct, 1),
            "provider": self.provider,
            "inference_count": self.inference_count,
            "avg_inference_ms": round(self.avg_inference_ms, 1),
            "last_inference_ms": self.last_inference_ms,
        }


_metrics = GpuMetrics()


def get_gpu_metrics() -> GpuMetrics:
    return _metrics


def record_inference(elapsed_ms: int) -> None:
    _metrics.inference_count += 1
    _metrics.total_inference_ms += elapsed_ms
    _metrics.last_inference_ms = elapsed_ms


def detect_gpu() -> dict:
    """Detect available GPU and populate metrics. Called once at startup."""
    m = _metrics

    # Try DirectML (onnxruntime-directml)
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        if "DmlExecutionProvider" in providers:
            m.gpu_available = True
            m.provider = "directml"
            m.gpu_name = _detect_dml_device()
            logger.info(f"DirectML GPU detected: {m.gpu_name}")
            return m.to_dict()
        elif "CUDAExecutionProvider" in providers:
            m.gpu_available = True
            m.provider = "cuda"
            _detect_cuda(m)
            logger.info(f"CUDA GPU detected: {m.gpu_name}")
            return m.to_dict()
    except ImportError:
        pass

    # Try PyTorch CUDA
    try:
        import torch
        if torch.cuda.is_available():
            m.gpu_available = True
            m.provider = "cuda"
            m.gpu_name = torch.cuda.get_device_name(0)
            props = torch.cuda.get_device_properties(0)
            m.gpu_memory_total_mb = props.total_mem // (1024 * 1024)
            m.gpu_memory_used_mb = torch.cuda.memory_allocated(0) // (1024 * 1024)
            logger.info(f"PyTorch CUDA GPU detected: {m.gpu_name}")
            return m.to_dict()
    except ImportError:
        pass

    logger.info("no GPU detected — using CPU only")
    return m.to_dict()


def _detect_dml_device() -> str:
    try:
        import onnxruntime as ort
        # DirectML doesn't expose device name easily — check for DML
        return "DirectML Device (Windows)"
    except Exception:
        return "unknown"


def _detect_cuda(m) -> None:
    try:
        import torch
        m.gpu_name = torch.cuda.get_device_name(0)
        props = torch.cuda.get_device_properties(0)
        m.gpu_memory_total_mb = props.total_mem // (1024 * 1024)
        m.gpu_memory_used_mb = torch.cuda.memory_allocated(0) // (1024 * 1024)
    except Exception:
        m.gpu_name = "CUDA Device (unknown)"


def refresh_metrics() -> dict:
    """Refresh GPU memory/utilization metrics. Should be called periodically."""
    m = _metrics
    m.last_check = time.time()

    if m.provider == "cuda":
        try:
            import torch
            if torch.cuda.is_available():
                m.gpu_memory_used_mb = torch.cuda.memory_allocated(0) // (1024 * 1024)
                # Utilization approximation via memory pressure
                if m.gpu_memory_total_mb > 0:
                    m.gpu_utilization_pct = (
                        m.gpu_memory_used_mb / m.gpu_memory_total_mb * 100
                    )
        except Exception:
            pass

    return m.to_dict()
