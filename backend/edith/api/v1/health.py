"""
Health and readiness probes for EDITH backend.
"""

from __future__ import annotations
from typing import Dict, Any
from fastapi import APIRouter
from edith.config import settings
from edith.providers.hardware import HardwareProfiler

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=Dict[str, Any])
async def health_check() -> Dict[str, Any]:
    """Basic health check probe for Tauri sidecar and frontend."""
    hardware = HardwareProfiler.detect_capabilities()
    return {
        "status": "healthy",
        "name": settings.name,
        "version": settings.version,
        "environment": settings.environment,
        "hardware": hardware,
        "models": {
            "primary_provider": settings.models.primary_provider,
            "routing_model": settings.models.local.routing_model,
            "complex_model": settings.models.local.complex_model,
        },
    }

