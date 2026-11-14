"""
Pytest integration test suite for EDITH Foundation & Core Endpoints.
"""

import os
import pytest
from fastapi.testclient import TestClient

from edith.server import create_app
from edith.providers.hardware import HardwareProfiler
from edith.memory.models import Conversation, Message, Task, SecurityAuditLog


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_hardware_profiler():
    """Verify hardware profiler correctly detects CPU cores, RAM, and profile."""
    hardware = HardwareProfiler.detect_capabilities()
    assert "cpu_cores_physical" in hardware
    assert hardware["cpu_cores_physical"] > 0
    assert "total_ram_gb" in hardware
    assert hardware["total_ram_gb"] > 0
    assert hardware["recommended_profile"] in ["cpu_efficient", "cuda_accelerated"]
    assert hardware["whisper_device"] in ["cpu", "cuda"]
    print(f"\n[Hardware Detected] Profile: {hardware['recommended_profile']} | RAM: {hardware['total_ram_gb']}GB | Device: {hardware['device_name']}")


def test_health_endpoint(client):
    """Verify health probe returns 200 with complete system and model details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["name"] == "EDITH"
    assert "hardware" in data
    assert "models" in data
    assert data["models"]["routing_model"] == "qwen2.5:3b"


def test_system_telemetry_endpoint(client):
    """Verify real-time system telemetry produces valid CPU, RAM, and Disk metrics."""
    response = client.get("/api/v1/system/telemetry")
    assert response.status_code == 200
    data = response.json()
    assert "cpu" in data
    assert "memory" in data
    assert "disk" in data
    assert "battery" in data
    assert 0 <= data["cpu"]["total_percent"] <= 100
    assert data["memory"]["total_gb"] > 0
    assert 0 <= data["memory"]["percent"] <= 100
    print(f"\n[Telemetry Verified] CPU: {data['cpu']['total_percent']}% | RAM: {data['memory']['percent']}%")


def test_auth_token_middleware():
    """Verify endpoints enforce bearer token when EDITH_AUTH_TOKEN is configured."""
    os.environ["EDITH_AUTH_TOKEN"] = "edith-secret-test-token"
    try:
        app = create_app()
        with TestClient(app) as auth_client:
            # Health check is public
            health_res = auth_client.get("/health")
            assert health_res.status_code == 200

            # Protected endpoint without token should return 401
            unauth_res = auth_client.get("/api/v1/system/telemetry")
            assert unauth_res.status_code == 401

            # Protected endpoint with bad token should return 403
            bad_res = auth_client.get(
                "/api/v1/system/telemetry",
                headers={"Authorization": "Bearer wrong-token"},
            )
            assert bad_res.status_code == 403

            # Protected endpoint with valid token should succeed (200)
            valid_res = auth_client.get(
                "/api/v1/system/telemetry",
                headers={"Authorization": "Bearer edith-secret-test-token"},
            )
            assert valid_res.status_code == 200
    finally:
        os.environ.pop("EDITH_AUTH_TOKEN", None)
