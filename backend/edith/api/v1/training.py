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
    """Returns active continuous training status, dataset count, learned patterns, and logs."""
    return {
        "enabled": continuous_learner.enabled,
        "is_training": continuous_learner.is_training,
        "total_pairs": continuous_learner.total_pairs,
        "last_trained_at": continuous_learner.last_trained_at,
        "logs": continuous_learner.get_human_logs(),
        "patterns": continuous_learner.get_command_patterns(),
        "stats": continuous_learner.get_pattern_stats(),
        "how_it_learns": [
            {
                "step": "1. Command & Query Capture",
                "detail": "Every voice or chat instruction—whether handled by local tools, offline Qwen/Ollama, or online Cloud LLMs—is captured in real time.",
            },
            {
                "step": "2. Offline + Online Knowledge Fusion",
                "detail": "Answers from Online LLMs (news, research, general knowledge) and Offline Local LLMs are distilled into ChromaDB vector memory and personal_dataset.jsonl.",
            },
            {
                "step": "3. Local Ollama Personalization",
                "detail": "Periodic and on-demand sync cycles compile Modelfile.edith and instruction pairs so your local offline model learns your commands and habits.",
            },
        ],
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

