"""
Security & Action Authorization Endpoints for EDITH.
Allows the Tauri frontend to resolve pending action challenges and inspect audit logs.
"""

from __future__ import annotations
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from edith.core.orchestrator import orchestrator
from edith.security.permissions import AuthorizationMode
from edith.security.audit import AuditLogger

router = APIRouter(prefix="/actions", tags=["Actions & Security"])


class DirectExecuteRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]


@router.get("/pending")
async def get_pending_actions() -> List[Dict[str, Any]]:
    """Returns currently pending authorization challenges."""
    return [p.model_dump() for p in orchestrator.pending_actions.values()]


@router.post("/authorize/{action_id}")
async def authorize_action(action_id: str) -> Dict[str, Any]:
    """Authorizes and executes a pending action challenge."""
    res = await orchestrator.resolve_authorization(
        action_id=action_id,
        approved=True,
        mode=AuthorizationMode.GUI_MODAL_CONFIRMED,
    )
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


@router.post("/deny/{action_id}")
async def deny_action(action_id: str) -> Dict[str, Any]:
    """Denies and rejects a pending action challenge."""
    res = await orchestrator.resolve_authorization(
        action_id=action_id,
        approved=False,
        mode=AuthorizationMode.DENIED,
    )
    return res


@router.get("/audit")
async def get_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns recent security audit logs for the HUD timeline."""
    return await AuditLogger.get_recent_logs(limit=limit)


@router.post("/execute")
async def execute_tool_directly(req: DirectExecuteRequest) -> Dict[str, Any]:
    """Direct execution entry point with automatic risk tier check."""
    return await orchestrator.execute_or_request_authorization(
        tool_name=req.tool_name,
        parameters=req.parameters,
    )

