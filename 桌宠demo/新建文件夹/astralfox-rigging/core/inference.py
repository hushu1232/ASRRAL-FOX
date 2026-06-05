"""ONNX Runtime inference engine — DirectML / CUDA / CPU provider chain."""

import time
import numpy as np
from pathlib import Path
from loguru import logger

from core.config import settings


class InferenceEngine:
    """Thin wrapper around ONNX Runtime with automatic provider selection.

    Provider priority: DirectML > CUDA > CPU
    """

    def __init__(self):
        self._session = None
        self._provider: str | None = None
        self._ort = None
        self._init_ort()

    def _init_ort(self):
        try:
            import onnxruntime as ort
            self._ort = ort
        except ImportError:
            logger.warning("onnxruntime not installed — ONNX inference disabled")
            return

        providers = self._ort.get_available_providers()
        logger.info(f"available ONNX providers: {providers}")

        # Provider priority chain
        for candidate in ["DmlExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"]:
            if candidate in providers:
                self._provider = candidate
                logger.info(f"ONNX inference using provider: {candidate}")
                return

        logger.warning("no suitable ONNX provider found")

    @property
    def available(self) -> bool:
        return self._ort is not None and self._provider is not None

    @property
    def provider(self) -> str | None:
        return self._provider

    def create_session(self, model_path: str | Path) -> "InferenceSession":
        """Load an ONNX model and return an inference session."""
        if not self.available:
            raise RuntimeError("ONNX Runtime not available")

        sess_options = self._ort.SessionOptions()
        sess_options.graph_optimization_level = (
            self._ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        sess_options.enable_mem_pattern = True
        sess_options.enable_cpu_mem_arena = False  # let GPU manage memory

        # Provider-specific options
        providers = []
        if self._provider == "DmlExecutionProvider":
            providers.append(("DmlExecutionProvider", {"device_id": 0}))
        providers.append((self._provider, {}))

        session = self._ort.InferenceSession(
            str(model_path),
            sess_options=sess_options,
            providers=providers,
        )
        logger.info(f"loaded ONNX model: {model_path} ({self._provider})")
        return session

    def run_inference(
        self,
        session,
        input_dict: dict[str, np.ndarray],
    ) -> list[np.ndarray]:
        """Run inference on a loaded session.

        Args:
            session: ONNX Runtime InferenceSession
            input_dict: {input_name: numpy_array}

        Returns:
            List of output numpy arrays
        """
        start = time.perf_counter()
        outputs = session.run(None, input_dict)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        logger.debug(f"inference completed in {elapsed_ms}ms ({self._provider})")
        return outputs


# Singleton
_engine: InferenceEngine | None = None


def get_inference_engine() -> InferenceEngine:
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
    return _engine
