"""
MCP Tool Bridge for EDITH Orchestrator.
Allows EDITH voice/chat commands to invoke any connected MCP server tool.
"""

from __future__ import annotations
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from edith.security.permissions import ActionRiskTier
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.mcp.manager import mcp_manager


class MCPInvokeParams(BaseModel):
    server_id: str = Field(..., description="MCP server id (e.g. 'edith-core-mcp', 'gmail', 'github').")
    tool_name: str = Field(..., description="Tool name exposed by the MCP server.")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="JSON arguments for the MCP tool.")


class MCPInvokeTool(BaseTool):
    name = "invoke_mcp_tool"
    description = "Invokes a tool from any connected MCP server (notes, web fetch, code search, Gmail, Calendar, GitHub, etc.)."
    risk_tier = ActionRiskTier.LOW_RISK_REVERSIBLE
    parameters_schema = MCPInvokeParams

    async def execute(
        self,
        server_id: str,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> ToolExecutionResult:
        try:
            res = await mcp_manager.call_tool(
                server_id=server_id,
                tool_name=tool_name,
                arguments=arguments or {},
            )
            return ToolExecutionResult(
                success=not res.get("is_error", False),
                data=res,
                message=str(res.get("output", "MCP tool completed.")),
                verified=not res.get("is_error", False),
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"MCP tool '{server_id}.{tool_name}' failed: {e}",
                verified=False,
            )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        return result is not None and result.success
