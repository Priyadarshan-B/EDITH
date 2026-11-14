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
)
from edith.tools.filesystem import (
    ReadFileTool,
    WriteFileTool,
    DeleteFileTool,
    SearchFilesTool,
)
from edith.tools.terminal import ExecuteTerminalCommandTool
from edith.tools.developer import GitStatusTool, DirectoryTreeTool


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        tools = [
            LaunchAppTool(),
            ListRunningAppsTool(),
            GetActiveWindowTool(),
            ReadFileTool(),
            WriteFileTool(),
            DeleteFileTool(),
            SearchFilesTool(),
            ExecuteTerminalCommandTool(),
            GitStatusTool(),
            DirectoryTreeTool(),
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

