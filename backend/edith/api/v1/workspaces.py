"""
Workspace Management API endpoints for EDITH.
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from edith.workspace.manager import workspace_manager

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


class SelectWorkspaceRequest(BaseModel):
    path: str = Field(..., min_length=1)
    create_if_missing: bool = False


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=260)
    template: str = Field(default="empty")
    parent_dir: Optional[str] = None


class OpenEditorRequest(BaseModel):
    path: Optional[str] = None
    editor: str = Field(default="antigravity")


@router.get("")
async def list_workspaces():
    """Lists discovered workspaces under allowed project roots."""
    return {
        "projects_root": str(workspace_manager.get_projects_root()),
        "edith_root": str(workspace_manager.edith_root),
        "active_workspace": workspace_manager.get_workspace_info(workspace_manager.active_workspace),
        "workspaces": workspace_manager.list_workspaces(),
    }


@router.post("/select")
async def select_workspace(payload: SelectWorkspaceRequest):
    """Switches the active EDITH workspace."""
    try:
        info = workspace_manager.set_active_workspace(
            payload.path,
            create_if_missing=payload.create_if_missing,
        )
        return {"active_workspace": info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create")
async def create_workspace(payload: CreateWorkspaceRequest):
    """Creates and activates a new project workspace."""
    try:
        info = workspace_manager.create_workspace(
            name=payload.name,
            template=payload.template,
            parent_dir=payload.parent_dir,
        )
        return {"active_workspace": info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/browse")
async def browse_workspace_folder():
    """Opens a native Windows folder dialog so the user can pick any save directory."""
    try:
        selected = workspace_manager.browse_folder_dialog()
        return {
            "selected": selected,
            "active_workspace": workspace_manager.get_workspace_info(workspace_manager.active_workspace),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/open")
async def open_workspace_in_editor(payload: OpenEditorRequest):
    """Opens the active or specified workspace in Antigravity IDE or VS Code."""
    try:
        return workspace_manager.open_in_editor(path=payload.path, editor=payload.editor)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
