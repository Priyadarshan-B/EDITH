"""
EDITH MCP Hub Manager.
Connects to configured stdio MCP servers using the official mcp Python SDK (v2.x),
discovers tools dynamically, and executes MCP tool calls.
"""

from __future__ import annotations
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from loguru import logger


class MCPManager:
    """Manages configured MCP servers, tool discovery, and tool execution."""

    def __init__(self, config_path: str = "config/mcp_servers.json"):
        self.config_path = Path(config_path)
        self._servers: Dict[str, Dict[str, Any]] = {}
        self._discovered_tools: Dict[str, List[Dict[str, Any]]] = {}
        self._server_status: Dict[str, str] = {}
        self._server_errors: Dict[str, Optional[str]] = {}
        self._load_config()

    def _load_config(self):
        if not self.config_path.exists():
            self._servers = {}
            return
        try:
            data = json.loads(self.config_path.read_text(encoding="utf-8"))
            self._servers = {s["id"]: s for s in data.get("servers", [])}
            for sid, srv in self._servers.items():
                self._server_status.setdefault(sid, "ready" if not srv.get("enabled") else "connecting")
                self._server_errors.setdefault(sid, None)
        except Exception as e:
            logger.error(f"Failed to load MCP config: {e}")

    def _save_config(self):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"servers": list(self._servers.values())}
        self.config_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @staticmethod
    def _resolve_command(cmd: str) -> str:
        if cmd == "__VENV_PYTHON__":
            return sys.executable
        if os.name == "nt" and cmd in ("npx", "npm", "uvx", "node"):
            found = shutil.which(f"{cmd}.cmd") or shutil.which(cmd)
            return found or cmd
        return shutil.which(cmd) or cmd

    def _build_env(self, srv: Dict[str, Any]) -> Dict[str, str]:
        env = os.environ.copy()
        for k, v in (srv.get("env") or {}).items():
            if v and str(v).strip():
                env[k] = str(v).strip()
        return env

    async def discover_server_tools(self, server_id: str) -> List[Dict[str, Any]]:
        """Connects briefly to an MCP stdio server to verify health & list its tools."""
        srv = self._servers.get(server_id)
        if not srv:
            raise ValueError(f"Unknown MCP server: {server_id}")

        # Check for empty required env vars
        missing_env = [
            k for k, v in (srv.get("env") or {}).items()
            if not str(v).strip() and not os.environ.get(k, "").strip()
        ]
        if missing_env:
            self._server_status[server_id] = "needs_config"
            self._server_errors[server_id] = f"Missing config/credentials: {', '.join(missing_env)}"
            return []

        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        cmd = self._resolve_command(srv["command"])
        params = StdioServerParameters(
            command=cmd,
            args=srv.get("args", []),
            env=self._build_env(srv),
        )

        try:
            async with stdio_client(params) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tools_res = await session.list_tools()
                    tools_list = [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "input_schema": t.inputSchema if hasattr(t, "inputSchema") else {},
                        }
                        for t in tools_res.tools
                    ]
                    self._discovered_tools[server_id] = tools_list
                    self._server_status[server_id] = "connected"
                    self._server_errors[server_id] = None
                    logger.info(f"MCP '{server_id}' connected ({len(tools_list)} tools).")
                    return tools_list
        except Exception as e:
            self._server_status[server_id] = "error"
            self._server_errors[server_id] = str(e)
            logger.warning(f"MCP '{server_id}' discovery error: {e}")
            return []

    async def initialize_enabled_servers(self):
        """Connects to all enabled MCP servers on backend startup."""
        for sid, srv in list(self._servers.items()):
            if srv.get("enabled"):
                await self.discover_server_tools(sid)

    async def toggle_server(self, server_id: str, enabled: bool) -> Dict[str, Any]:
        srv = self._servers.get(server_id)
        if not srv:
            raise ValueError(f"Unknown MCP server: {server_id}")
        srv["enabled"] = enabled
        self._save_config()
        if enabled:
            await self.discover_server_tools(server_id)
        else:
            self._server_status[server_id] = "disabled"
            self._server_errors[server_id] = None
        return self.get_server_info(server_id)

    async def update_server_env(self, server_id: str, env_updates: Dict[str, str]) -> Dict[str, Any]:
        srv = self._servers.get(server_id)
        if not srv:
            raise ValueError(f"Unknown MCP server: {server_id}")
        cur_env = srv.get("env") or {}
        cur_env.update(env_updates)
        srv["env"] = cur_env
        self._save_config()
        if srv.get("enabled"):
            await self.discover_server_tools(server_id)
        else:
            self._server_status[server_id] = "ready"
            self._server_errors[server_id] = None
        return self.get_server_info(server_id)

    async def add_custom_server(
        self,
        server_id: str,
        name: str,
        command: str,
        args: List[str],
        category: str = "developer",
        description: str = "",
        env: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        clean_id = "".join(c for c in server_id.lower().strip() if c.isalnum() or c in ("-", "_"))
        if not clean_id:
            raise ValueError("Invalid MCP server id.")
        self._servers[clean_id] = {
            "id": clean_id,
            "name": name.strip() or clean_id,
            "category": category,
            "description": description.strip() or "Custom stdio MCP server",
            "transport": "stdio",
            "command": command.strip(),
            "args": args,
            "env": env or {},
            "enabled": True,
            "setup_hint": "Custom user-configured MCP server.",
        }
        self._save_config()
        await self.discover_server_tools(clean_id)
        return self.get_server_info(clean_id)

    async def call_tool(self, server_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a tool on the specified MCP server via ClientSession."""
        srv = self._servers.get(server_id)
        if not srv:
            raise ValueError(f"Unknown MCP server: {server_id}")

        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        cmd = self._resolve_command(srv["command"])
        params = StdioServerParameters(
            command=cmd,
            args=srv.get("args", []),
            env=self._build_env(srv),
        )
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments=arguments)
                texts = []
                for item in getattr(result, "content", []) or []:
                    if hasattr(item, "text") and item.text:
                        texts.append(item.text)
                    else:
                        texts.append(str(item))
                return {
                    "server_id": server_id,
                    "tool_name": tool_name,
                    "is_error": bool(getattr(result, "isError", False)),
                    "output": "\n".join(texts) if texts else "Completed.",
                }

    def get_server_info(self, server_id: str) -> Dict[str, Any]:
        srv = self._servers[server_id]
        return {
            "id": srv["id"],
            "name": srv["name"],
            "category": srv.get("category", "developer"),
            "description": srv.get("description", ""),
            "command": srv["command"],
            "args": srv.get("args", []),
            "env_keys": list((srv.get("env") or {}).keys()),
            "enabled": bool(srv.get("enabled", False)),
            "status": self._server_status.get(server_id, "ready"),
            "error": self._server_errors.get(server_id),
            "setup_hint": srv.get("setup_hint", ""),
            "tools": self._discovered_tools.get(server_id, []),
        }

    def list_servers(self) -> List[Dict[str, Any]]:
        return [self.get_server_info(sid) for sid in self._servers]


mcp_manager = MCPManager()
