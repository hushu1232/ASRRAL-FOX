"""Health endpoint tests."""

import pytest


def test_health_returns_ok(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "gpu" in data
    assert "gpu_available" in data["gpu"]
    assert "provider" in data["gpu"]


def test_root_returns_service_info(client):
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "astralfox-rigging"


def test_health_response_time(client):
    import time
    start = time.perf_counter()
    res = client.get("/api/health")
    elapsed = time.perf_counter() - start
    assert res.status_code == 200
    assert elapsed < 1.0, f"Health check took {elapsed:.2f}s, expected < 1s"


def test_timing_header(client):
    res = client.get("/api/health")
    assert "X-Process-Time-Ms" in res.headers
