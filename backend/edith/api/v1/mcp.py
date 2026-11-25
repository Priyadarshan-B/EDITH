"""
MCP Hub API Endpoints for EDITH.
Allows listing, toggling, configuring, adding, and invoking MCP servers & tools.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from edith.mcp.manager import mcp_manager

router = APIRouter(prefix="/mcp", tags=["MCP Hub"])


class ToggleMCPRequest(BaseModel):
    enabled: bool


class UpdateMCPEnvRequest(BaseModel):
    env: Dict[str, str]


class AddMCPServerRequest(BaseModel):
    id: str = Field(..., min_length=2, max_length=60)
    name: str = Field(..., min_length=2, max_length=100)
    command: str = Field(..., min_length=1)
    args: List[str] = Field(default_factory=list)
    category: str = Field(default="developer")
    description: str = Field(default="")
    env: Dict[str, str] = Field(default_factory=dict)


class CallMCPToolRequest(BaseModel):
    server_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


@router.get("/servers")
async def list_mcp_servers():
    """Lists all configured MCP servers, connection states, and discovered tools."""
    return {"servers": mcp_manager.list_servers()}


@router.post("/servers/{server_id}/toggle")
async def toggle_mcp_server(server_id: str, payload: ToggleMCPRequest):
    """Enables/connects or disables an MCP server."""
    try:
        return await mcp_manager.toggle_server(server_id, payload.enabled)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers/{server_id}/env")
async def update_mcp_env(server_id: str, payload: UpdateMCPEnvRequest):
    """Updates API keys / environment variables for an MCP server."""
    try:
        return await mcp_manager.update_server_env(server_id, payload.env)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers")
async def add_custom_mcp_server(payload: AddMCPServerRequest):
    """Adds and connects a custom stdio MCP server."""
    try:
        return await mcp_manager.add_custom_server(
            server_id=payload.id,
            name=payload.name,
            command=payload.command,
            args=payload.args,
            category=payload.category,
            description=payload.description,
            env=payload.env,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tools/call")
async def call_mcp_tool(payload: CallMCPToolRequest):
    """Executes an MCP tool and returns its output."""
    try:
        return await mcp_manager.call_tool(
            server_id=payload.server_id,
            tool_name=payload.tool_name,
            arguments=payload.arguments,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
