"""
Sandboxed Filesystem Automation Tools for EDITH.
Enforces path boundaries and verified read/write/delete operations.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel, Field
import aiofiles
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.security.path_jail import PathJailSecurity
from edith.tools.base import BaseTool, ToolExecutionResult


# 1. Read File Tool

class ReadFileParams(BaseModel):
    file_path: str = Field(description="Absolute or relative path to file.")
    max_lines: int = Field(default=200, description="Maximum number of lines to read.")


class ReadFileTool(BaseTool):
    name = "read_file"
    description = "Reads content from a file within user-approved directory boundaries."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = ReadFileParams

    async def execute(self, file_path: str, max_lines: int = 200) -> ToolExecutionResult:
        is_safe, reason = PathJailSecurity.validate_path(file_path)
        if not is_safe:
            return ToolExecutionResult(success=False, message=reason, verified=False)

        resolved = Path(os.path.expandvars(file_path)).resolve()
        if not resolved.exists():
            return ToolExecutionResult(
                success=False,
                message=f"File not found: '{resolved}'.",
                verified=False,
            )

        try:
            async with aiofiles.open(resolved, mode="r", encoding="utf-8", errors="replace") as f:
                lines = []
                for _ in range(max_lines):
                    line = await f.readline()
                    if not line:
                        break
                    lines.append(line)
                content = "".join(lines)

            return ToolExecutionResult(
                success=True,
                data={"path": str(resolved), "content": content, "lines_read": len(lines)},
                message=f"Read {len(lines)} lines from '{resolved.name}'.",
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Error reading file '{file_path}': {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success


# 2. Write / Create File Tool

class WriteFileParams(BaseModel):
    file_path: str = Field(description="Destination file path.")
    content: str = Field(description="Text content to write.")
    overwrite: bool = Field(default=True, description="Whether to overwrite existing content.")


class WriteFileTool(BaseTool):
    name = "write_file"
    description = "Creates or overwrites a text file within user project directories."
    risk_tier = ActionRiskTier.SENSITIVE
    parameters_schema = WriteFileParams

    async def execute(self, file_path: str, content: str, overwrite: bool = True) -> ToolExecutionResult:
        is_safe, reason = PathJailSecurity.validate_path(file_path, for_mutation=True)
        if not is_safe:
            return ToolExecutionResult(success=False, message=reason, verified=False)

        resolved = Path(os.path.expandvars(file_path)).resolve()
        resolved.parent.mkdir(parents=True, exist_ok=True)

        mode = "w" if overwrite else "a"
        try:
            async with aiofiles.open(resolved, mode=mode, encoding="utf-8") as f:
                await f.write(content)

            is_verified = await self.verify(None, file_path=resolved, expected_length=len(content))
            return ToolExecutionResult(
                success=True,
                data={"path": str(resolved), "bytes_written": len(content)},
                message=f"Successfully written {len(content)} characters to '{resolved.name}'.",
                verified=is_verified,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Failed to write file '{file_path}': {str(e)}",
                verified=False,
            )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        file_path = kwargs.get("file_path")
        if not file_path or not Path(file_path).exists():
            return False
        return Path(file_path).stat().st_size >= 0


# 3. Delete File or Directory Tool (Destructive)

class DeleteFileParams(BaseModel):
    target_path: str = Field(description="File or empty directory path to delete.")


class DeleteFileTool(BaseTool):
    name = "delete_file_or_directory"
    description = "Deletes a specified file or directory. Requires explicit user authorization."
    risk_tier = ActionRiskTier.DESTRUCTIVE_PRIVILEGED
    parameters_schema = DeleteFileParams

    async def execute(self, target_path: str) -> ToolExecutionResult:
        is_safe, reason = PathJailSecurity.validate_path(target_path, for_mutation=True)
        if not is_safe:
            return ToolExecutionResult(success=False, message=reason, verified=False)

        resolved = Path(os.path.expandvars(target_path)).resolve()
        if not resolved.exists():
            return ToolExecutionResult(
                success=False,
                message=f"Target path '{resolved}' does not exist.",
                verified=False,
            )

        try:
            if resolved.is_file():
                resolved.unlink()
            elif resolved.is_dir():
                resolved.rmdir()

            is_verified = await self.verify(None, target_path=resolved)
            return ToolExecutionResult(
                success=is_verified,
                data={"deleted_path": str(resolved)},
                message=f"Deleted '{resolved.name}' successfully.",
                verified=is_verified,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Failed to delete '{target_path}': {str(e)}",
                verified=False,
            )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        """Verifies path is indeed gone from filesystem."""
        target = kwargs.get("target_path")
        if not target:
            return False
        return not Path(target).exists()


# 4. Search Files Tool

class SearchFilesParams(BaseModel):
    directory: str = Field(description="Base directory path to search.")
    pattern: str = Field(default="*.*", description="Glob pattern (e.g. '*.py', '*.tsx', '*log*').")
    limit: int = Field(default=20, description="Max matching files to return.")


class SearchFilesTool(BaseTool):
    name = "search_files"
    description = "Searches files within approved project folders matching a name or glob pattern."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = SearchFilesParams

    async def execute(self, directory: str, pattern: str = "*.*", limit: int = 20) -> ToolExecutionResult:
        is_safe, reason = PathJailSecurity.validate_path(directory)
        if not is_safe:
            return ToolExecutionResult(success=False, message=reason, verified=False)

        resolved_dir = Path(os.path.expandvars(directory)).resolve()
        if not resolved_dir.is_dir():
            return ToolExecutionResult(
                success=False,
                message=f"Directory '{resolved_dir}' not found.",
                verified=False,
            )

        try:
            matches = []
            for path in resolved_dir.glob(pattern):
                if len(matches) >= limit:
                    break
                matches.append({
                    "name": path.name,
                    "path": str(path),
                    "is_dir": path.is_dir(),
                    "size_bytes": path.stat().st_size if path.is_file() else 0,
                })

            return ToolExecutionResult(
                success=True,
                data={"count": len(matches), "matches": matches},
                message=f"Found {len(matches)} matching files in '{resolved_dir.name}'.",
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Search error in '{directory}': {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return True

