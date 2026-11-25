"""
Vision & Hybrid Camera Virtual Mouse API endpoints for EDITH.
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from edith.vision.virtual_mouse import virtual_mouse

router = APIRouter(prefix="/vision", tags=["Vision"])


class VirtualMouseToggleRequest(BaseModel):
    enabled: bool
    camera_index: int = Field(default=0, ge=0, le=5)
    sensitivity: Optional[float] = Field(default=None, ge=0.5, le=2.5)


class VirtualMouseConfigRequest(BaseModel):
    camera_index: Optional[int] = Field(default=None, ge=0, le=5)
    sensitivity: Optional[float] = Field(default=None, ge=0.5, le=2.5)
    smoothing: Optional[float] = Field(default=None, ge=0.1, le=0.9)
    deadzone: Optional[float] = Field(default=None, ge=0.0, le=20.0)
    scroll_speed: Optional[float] = Field(default=None, ge=0.3, le=3.0)
    drag_enabled: Optional[bool] = None
    mirror: Optional[bool] = None


class VirtualMouseActionRequest(BaseModel):
    action: Optional[str] = None
    nx: Optional[float] = None
    ny: Optional[float] = None
    dy: Optional[int] = None
    dx: Optional[int] = None
    gesture: Optional[str] = None
    error: Optional[str] = None


@router.get("/mouse/status")
async def get_virtual_mouse_status():
    """Returns current status and settings of the hybrid virtual mouse controller."""
    return virtual_mouse.status()


@router.post("/mouse/toggle")
async def toggle_virtual_mouse(payload: VirtualMouseToggleRequest):
    """Enables or disables the hybrid virtual mouse."""
    if payload.enabled:
        return virtual_mouse.start(
            camera_index=payload.camera_index,
            sensitivity=payload.sensitivity,
        )
    return virtual_mouse.stop()


@router.post("/mouse/config")
async def configure_virtual_mouse(payload: VirtualMouseConfigRequest):
    """Updates live tuning options for the virtual mouse."""
    return virtual_mouse.update_config(
        camera_index=payload.camera_index,
        sensitivity=payload.sensitivity,
        smoothing=payload.smoothing,
        deadzone=payload.deadzone,
        scroll_speed=payload.scroll_speed,
        drag_enabled=payload.drag_enabled,
        mirror=payload.mirror,
    )


@router.post("/mouse/event")
async def dispatch_virtual_mouse_event(payload: VirtualMouseActionRequest):
    """HTTP fallback for dispatching a virtual mouse action."""
    virtual_mouse.handle_event(payload.model_dump())
    return {"ok": True}
