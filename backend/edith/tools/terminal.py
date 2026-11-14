"""
Terminal Command Execution Tool for EDITH.
Executes approved developer commands with strict blacklist filtering and timeout enforcement.
"""

from __future__ import annotations
import asyncio
import subprocess
from pydantic import BaseModel, Field
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.security.sanitizer import CommandSanitizer
from edith.tools.base import BaseTool, ToolExecutionResult


class TerminalCommandParams(BaseModel):
    command: str = Field(description="Shell command line to execute.")
    working_dir: str = Field(default=".", description="Working directory for the command.")


class ExecuteTerminalCommandTool(BaseTool):
    name = "execute_terminal_command"
    description = "Executes an approved terminal shell command in Windows PowerShell. Requires explicit GUI confirmation."
    risk_tier = ActionRiskTier.DESTRUCTIVE_PRIVILEGED
    parameters_schema = TerminalCommandParams

    async def execute(self, command: str, working_dir: str = ".") -> ToolExecutionResult:
        is_safe, reason = CommandSanitizer.sanitize(command)
        if not is_safe:
            return ToolExecutionResult(
                success=False,
                message=reason,
                verified=False,
            )

        logger.info(f"Executing authorized terminal command: '{command}' in '{working_dir}'")
        try:
            # Run command asynchronously with timeout
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=working_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                stdout_data, stderr_data = await asyncio.wait_for(proc.communicate(), timeout=30.0)
            except asyncio.TimeoutError:
                proc.kill()
                return ToolExecutionResult(
                    success=False,
                    message=f"Command timed out after 30 seconds: '{command}'.",
                    verified=False,
                )

            stdout_str = stdout_data.decode("utf-8", errors="replace").strip()
            stderr_str = stderr_data.decode("utf-8", errors="replace").strip()
            exit_code = proc.returncode

            is_verified = (exit_code == 0)
            return ToolExecutionResult(
                success=is_verified,
                data={
                    "command": command,
                    "exit_code": exit_code,
                    "stdout": stdout_str,
                    "stderr": stderr_str,
                },
                message=f"Command finished with exit code {exit_code}.",
                verified=is_verified,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Execution error: {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success
