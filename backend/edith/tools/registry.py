"""
Central Tool Registry for EDITH Orchestration.
Maintains active tools and generates LLM function calling specifications.
"""

from __future__ import annotations
from typing import Dict, List, Optional, Any
from edith.tools.base import BaseTool
from edith.tools.desktop import (
    LaunchAppTool,
    ListRunningAppsTool,
    GetActiveWindowTool,
    ToggleVirtualMouseTool,
)
from edith.tools.filesystem import (
    ReadFileTool,
    WriteFileTool,
    DeleteFileTool,
    SearchFilesTool,
)
from edith.tools.terminal import ExecuteTerminalCommandTool
from edith.tools.developer import GitStatusTool, DirectoryTreeTool, ManageWorkspaceTool
from edith.tools.antigravity_builder import AntigravityBuildTool, AskBuildLocationTool
from edith.tools.productivity import ManageTasksTool
from edith.tools.mcp_bridge import MCPInvokeTool
from edith.tools.system_info import SystemDiagnosticTool
from edith.tools.web_search import WebSearchTool, LiveWeatherTool
from edith.tools.mail import SendEmailTool, FetchEmailsTool
from edith.tools.whatsapp import WhatsAppSendMessageTool
from edith.tools.vision import ScreenVisionTool
from edith.tools.calendar import CreateCalendarEventTool, GetDailyBriefingTool
from edith.tools.media import MediaVolumeControlTool
from edith.tools.news import LiveNewsTool


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        tools = [
            LaunchAppTool(),
            ListRunningAppsTool(),
            GetActiveWindowTool(),
            ToggleVirtualMouseTool(),
            ReadFileTool(),
            WriteFileTool(),
            DeleteFileTool(),
            SearchFilesTool(),
            ExecuteTerminalCommandTool(),
            GitStatusTool(),
            DirectoryTreeTool(),
            ManageWorkspaceTool(),
            AntigravityBuildTool(),
            AskBuildLocationTool(),
            ManageTasksTool(),
            MCPInvokeTool(),
            SystemDiagnosticTool(),
            WebSearchTool(),
            LiveWeatherTool(),
            SendEmailTool(),
            FetchEmailsTool(),
            WhatsAppSendMessageTool(),
            ScreenVisionTool(),
            CreateCalendarEventTool(),
            GetDailyBriefingTool(),
            MediaVolumeControlTool(),
            LiveNewsTool(),
        ]
        for t in tools:
            self.register_tool(t)

    def register_tool(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """Generates OpenAI-compatible function definitions for LLM prompting."""
        return [tool.get_openai_tool_schema() for tool in self._tools.values()]


# Global registry singleton
tool_registry = ToolRegistry()

