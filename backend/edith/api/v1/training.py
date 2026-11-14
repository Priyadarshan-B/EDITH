"""
Training & Continuous Learning Endpoints for EDITH.
Allows frontend to inspect learning progress, toggle continuous personalization, and review human-readable logs.
"""

from __future__ import annotations
from typing import Dict, Any, List
from fastapi import APIRouter
from pydantic import BaseModel

from edith.memory.learner import continuous_learner

router = APIRouter(prefix="/training", tags=["Personalization & Training"])


class ToggleRequest(BaseModel):
    enabled: bool


@router.get("/status")
async def get_training_status() -> Dict[str, Any]:
    """Returns active continuous training status, dataset count, and logs."""
    return {
        "enabled": continuous_learner.enabled,
        "is_training": continuous_learner.is_training,
        "total_pairs": continuous_learner.total_pairs,
        "last_trained_at": continuous_learner.last_trained_at,
        "logs": continuous_learner.get_human_logs(),
    }


@router.post("/toggle")
async def toggle_continuous_training(req: ToggleRequest) -> Dict[str, Any]:
    """Enables or pauses automatic daily learning."""
    enabled = continuous_learner.set_enabled(req.enabled)
    return {
        "status": "success",
        "enabled": enabled,
    }


@router.post("/run")
async def run_training_now() -> Dict[str, Any]:
    """Triggers an immediate dataset compilation and model personalization cycle."""
    return await continuous_learner.run_personalization_cycle()

