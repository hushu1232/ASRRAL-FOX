"""Metrics endpoint tests."""

import pytest
from unittest.mock import patch


class TestMetricsEndpoint:
    def test_metrics_returns_plain_text(self, client):
        res = client.get("/api/metrics")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/plain")

    def test_metrics_contains_required_gauges(self, client):
        res = client.get("/api/metrics")
        text = res.text

        required = [
            "astralfox_rigging_up",
            "rigging_gpu_available",
            "rigging_gpu_memory_used_mb",
            "rigging_gpu_memory_total_mb",
            "rigging_gpu_utilization_pct",
            "rigging_inference_count_total",
            "rigging_inference_duration_ms_avg",
            "rigging_provider_info",
        ]

        for name in required:
            assert name in text, f"Missing metric: {name}"

    def test_metrics_includes_provider_label(self, client):
        res = client.get("/api/metrics")
        text = res.text
        assert 'provider="' in text

    def test_metrics_has_help_comments(self, client):
        res = client.get("/api/metrics")
        text = res.text
        assert "# HELP" in text
        assert "# TYPE" in text


class TestGpuMetrics:
    def test_default_metrics_cpu(self):
        from core.gpu_monitor import GpuMetrics
        m = GpuMetrics()
        d = m.to_dict()
        assert d["gpu_available"] is False
        assert d["provider"] == "cpu"
        assert d["inference_count"] == 0
        assert d["avg_inference_ms"] == 0.0

    def test_record_inference_updates_counters(self):
        from core.gpu_monitor import record_inference, get_gpu_metrics
        m = get_gpu_metrics()
        initial = m.inference_count
        record_inference(150)
        assert m.inference_count == initial + 1
        assert m.last_inference_ms == 150

    def test_detect_gpu_cpu_only(self):
        with patch("core.gpu_monitor.logger"):
            from core.gpu_monitor import detect_gpu
            result = detect_gpu()
            assert "provider" in result
            assert "gpu_available" in result

    def test_refresh_metrics_returns_dict(self):
        from core.gpu_monitor import refresh_metrics
        result = refresh_metrics()
        assert isinstance(result, dict)
        assert "gpu_available" in result
        assert "provider" in result
        assert "inference_count" in result
        assert "avg_inference_ms" in result
