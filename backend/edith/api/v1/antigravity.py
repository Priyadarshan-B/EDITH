"""
Antigravity SDK Project Builder API endpoints for EDITH.
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from edith.tools.antigravity_builder import antigravity_service

router = APIRouter(prefix="/antigravity", tags=["Antigravity"])


class BuildRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=4000)
    workspace_path: Optional[str] = None


@router.post("/build")
async def start_antigravity_build(payload: BuildRequest):
    """Starts an asynchronous Antigravity SDK build job in the target workspace."""
    try:
        return await antigravity_service.start_build(
            prompt=payload.prompt,
            workspace_path=payload.workspace_path,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/builds")
async def list_antigravity_builds():
    """Lists recent Antigravity build jobs and their live progress."""
    return {"builds": antigravity_service.list_jobs()}


@router.get("/builds/{build_id}")
async def get_antigravity_build(build_id: str):
    """Returns status and event stream for a specific Antigravity build job."""
    job = antigravity_service.get_job(build_id)
    if not job:
        raise HTTPException(status_code=404, detail="Build job not found")
    return job
