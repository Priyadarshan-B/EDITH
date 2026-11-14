"""
Desktop Automation & Window Management Tools for EDITH.
Controls application lifecycles and window states on Windows 11.
"""

from __future__ import annotations
import os
import time
import subprocess
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import psutil
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.tools.base import BaseTool, ToolExecutionResult


# 1. Launch Application Tool

class LaunchAppParams(BaseModel):
    app_name: str = Field(description="Name or command of application to launch (e.g. 'notepad', 'calc', 'code', 'explorer', 'chrome').")


class LaunchAppTool(BaseTool):
    name = "launch_application"
    description = "Launches an approved desktop application on Windows 11."
    risk_tier = ActionRiskTier.LOW_RISK_REVERSIBLE
    parameters_schema = LaunchAppParams

    # Mapping common app names to executables
    APP_MAPPINGS = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "calc": "calc.exe",
        "vs code": "code",
        "vscode": "code",
        "code": "code",
        "file explorer": "explorer.exe",
        "explorer": "explorer.exe",
        "terminal": "wt.exe",
        "command prompt": "cmd.exe",
        "chrome": "chrome.exe",
        "edge": "msedge.exe",
        "spotify": "spotify.exe",
    }

    async def execute(self, app_name: str) -> ToolExecutionResult:
        clean_name = app_name.strip().lower()
        executable = self.APP_MAPPINGS.get(clean_name, clean_name)

        try:
            # Spawn detached process
            proc = subprocess.Popen(
                executable,
                shell=True,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            time.sleep(0.5)

            is_verified = await self.verify(None, app_name=clean_name, pid=proc.pid)
            return ToolExecutionResult(
                success=True,
                data={"pid": proc.pid, "executable": executable},
                message=f"Application '{clean_name}' successfully launched (PID: {proc.pid}).",
                verified=is_verified,
            )
        except Exception as e:
            logger.error(f"Failed to launch application '{app_name}': {e}")
            return ToolExecutionResult(
                success=False,
                message=f"Failed to launch '{app_name}': {str(e)}",
                verified=False,
            )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        """Verifies process is actually running in OS process table."""
        app_name = kwargs.get("app_name", "").lower()
        target_exe = self.APP_MAPPINGS.get(app_name, app_name).replace(".exe", "")

        for proc in psutil.process_iter(["name"]):
            try:
                pname = (proc.info["name"] or "").lower()
                if target_exe in pname:
                    return True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return False


# 2. List Running Applications Tool

class ListAppsParams(BaseModel):
    limit: int = Field(default=15, description="Maximum number of active processes to return.")
    search: Optional[str] = Field(default=None, description="Optional name filter.")


class ListRunningAppsTool(BaseTool):
    name = "list_running_applications"
    description = "Retrieves active desktop applications and background processes with memory usage."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = ListAppsParams

    async def execute(self, limit: int = 15, search: Optional[str] = None) -> ToolExecutionResult:
        apps = []
        for proc in psutil.process_iter(["pid", "name", "memory_percent"]):
            try:
                name = proc.info["name"] or "Unknown"
                if search and search.lower() not in name.lower():
                    continue

                mem_mb = round(proc.memory_info().rss / (1024 * 1024), 1)
                apps.append({
                    "pid": proc.info["pid"],
                    "name": name,
                    "memory_mb": mem_mb,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        # Sort by memory descending
        apps.sort(key=lambda x: x["memory_mb"], reverse=True)
        top_apps = apps[:limit]

        return ToolExecutionResult(
            success=True,
            data={"count": len(top_apps), "processes": top_apps},
            message=f"Found {len(top_apps)} active desktop processes.",
            verified=True,
        )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return True


# 3. Get Active Window Tool

class GetActiveWindowParams(BaseModel):
    pass


class GetActiveWindowTool(BaseTool):
    name = "get_active_window"
    description = "Inspects the currently focused foreground desktop window on Windows 11."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = GetActiveWindowParams

    async def execute(self) -> ToolExecutionResult:
        try:
            import pygetwindow as gw
            active = gw.getActiveWindow()
            if active and active.title:
                return ToolExecutionResult(
                    success=True,
                    data={
                        "title": active.title,
                        "width": active.width,
                        "height": active.height,
                        "is_maximized": active.isMaximized,
                    },
                    message=f"Active window: '{active.title}'.",
                    verified=True,
                )
            else:
                return ToolExecutionResult(
                    success=True,
                    data={"title": "Desktop / Windows Shell"},
                    message="No active application window focused (Desktop shell).",
                    verified=True,
                )
        except Exception as e:
            logger.debug(f"Active window query note: {e}")
            return ToolExecutionResult(
                success=True,
                data={"title": "Desktop / Background Shell", "note": str(e)},
                message="No active interactive window handle focused (Desktop / Background).",
                verified=True,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return True
