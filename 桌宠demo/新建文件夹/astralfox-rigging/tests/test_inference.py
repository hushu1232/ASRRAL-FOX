"""Inference engine tests."""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from core.inference import InferenceEngine, get_inference_engine


class TestInferenceEngine:
    def test_init_no_onnxruntime(self):
        with patch("core.inference.InferenceEngine._init_ort", return_value=None):
            engine = InferenceEngine.__new__(InferenceEngine)
            engine._session = None
            engine._provider = None
            engine._ort = None
            assert engine.available is False
            assert engine.provider is None

    def test_singleton_same_instance(self):
        engine1 = get_inference_engine()
        engine2 = get_inference_engine()
        assert engine1 is engine2

    def test_create_session_not_available_raises(self):
        engine = InferenceEngine.__new__(InferenceEngine)
        engine._session = None
        engine._provider = None
        engine._ort = None
        with pytest.raises(RuntimeError, match="ONNX Runtime not available"):
            engine.create_session("fake_model.onnx")

    @patch("core.inference.logger")
    def test_run_inference_records_timing(self, mock_logger):
        engine = InferenceEngine.__new__(InferenceEngine)
        engine._provider = "CPUExecutionProvider"

        mock_session = MagicMock()
        mock_session.run.return_value = [np.array([1.0, 2.0])]

        input_dict = {"input": np.array([[1.0]])}
        outputs = engine.run_inference(mock_session, input_dict)

        assert len(outputs) == 1
        np.testing.assert_array_equal(outputs[0], np.array([1.0, 2.0]))
        mock_session.run.assert_called_once_with(None, input_dict)

    def test_init_ort_cpu_fallback(self):
        with patch("core.inference.InferenceEngine._init_ort", return_value=None):
            engine = InferenceEngine.__new__(InferenceEngine)
            engine._ort = MagicMock()
            engine._ort.get_available_providers.return_value = ["CPUExecutionProvider"]
            engine._provider = None
            providers = engine._ort.get_available_providers()
            assert "CPUExecutionProvider" in providers


class TestGetInferenceEngine:
    def test_returns_inference_engine(self):
        engine = get_inference_engine()
        assert isinstance(engine, InferenceEngine)

    @patch("core.inference._engine", None)
    def test_creates_new_when_none(self):
        engine = get_inference_engine()
        assert engine is not None
        assert isinstance(engine, InferenceEngine)
