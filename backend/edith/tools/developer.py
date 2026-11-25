"""
Developer Assistance and Codebase Inspection Tools for EDITH.
Provides safe repository inspection, git metrics, and project structural analysis.
"""

from __future__ import annotations
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.security.path_jail import PathJailSecurity
from edith.tools.base import BaseTool, ToolExecutionResult


class GitStatusParams(BaseModel):
    repo_path: str = Field(default=".", description="Path to Git repository directory.")


class DirectoryTreeParams(BaseModel):
    root_dir: str = Field(default=".", description="Directory to inspect.")
    max_depth: int = Field(default=3, ge=1, le=5, description="Maximum directory nesting depth.")


class GitStatusTool(BaseTool):
    """Inspects Git working tree status, branch name, and recent commit history."""

    name = "git_status_inspect"
    description = "Inspects Git repository status, current branch, and recent commit logs."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = GitStatusParams

    async def execute(self, repo_path: str = ".", **kwargs) -> ToolExecutionResult:
        try:
            resolved_repo = PathJailSecurity.resolve_and_validate(repo_path)

            # 1. Get current branch
            branch_proc = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=str(resolved_repo),
                capture_output=True,
                text=True,
                timeout=5,
            )
            branch = branch_proc.stdout.strip() or "HEAD (detached or not git)"

            # 2. Get status summary
            status_proc = subprocess.run(
                ["git", "status", "-s"],
                cwd=str(resolved_repo),
                capture_output=True,
                text=True,
                timeout=5,
            )
            status_lines = [l for l in status_proc.stdout.splitlines() if l.strip()]

            # 3. Get last 3 commits
            log_proc = subprocess.run(
                ["git", "log", "-n", "3", "--oneline"],
                cwd=str(resolved_repo),
                capture_output=True,
                text=True,
                timeout=5,
            )
            recent_commits = [c for c in log_proc.stdout.splitlines() if c.strip()]

            data = {
                "branch": branch,
                "changed_files_count": len(status_lines),
                "changed_files": status_lines[:20],
                "recent_commits": recent_commits,
                "clean": len(status_lines) == 0,
            }

            summary = f"Branch '{branch}' | {len(status_lines)} changed files | Clean: {len(status_lines) == 0}"
            return ToolExecutionResult(success=True, data=data, message=summary, verified=True)
        except Exception as e:
            return ToolExecutionResult(success=False, message=f"Failed to inspect git repository: {e}", verified=False)

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        """Verifies git inspection produced usable data."""
        return result is not None and result.success and result.data is not None


class DirectoryTreeTool(BaseTool):
    """Generates a hierarchical tree representation of project directories."""

    name = "directory_tree_inspect"
    description = "Generates a clean directory hierarchy tree with noise filters."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = DirectoryTreeParams

    IGNORE_DIRS = {
        ".git", "node_modules", ".venv", "venv", "__pycache__",
        "dist", "target", ".next", ".cache", ".pytest_cache", ".idea", ".vscode"
    }

    async def execute(self, root_dir: str = ".", max_depth: int = 3, **kwargs) -> ToolExecutionResult:
        try:
            resolved = PathJailSecurity.resolve_and_validate(root_dir)

            def build_tree(current_path: Path, depth: int) -> Dict[str, Any]:
                if depth > max_depth:
                    return {}

                node = {"name": current_path.name, "type": "directory", "children": []}
                try:
                    entries = sorted(list(current_path.iterdir()), key=lambda p: (not p.is_dir(), p.name.lower()))
                    for entry in entries:
                        if entry.name in self.IGNORE_DIRS or entry.name.startswith("."):
                            continue
                        if entry.is_dir():
                            child = build_tree(entry, depth + 1)
                            if child:
                                node["children"].append(child)
                        else:
                            node["children"].append({"name": entry.name, "type": "file", "size": entry.stat().st_size})
                except PermissionError:
                    pass
                return node

            tree = build_tree(resolved, depth=1)
            summary = f"Generated directory tree for '{resolved.name}' (depth {max_depth})"
            return ToolExecutionResult(success=True, data=tree, message=summary, verified=True)
        except Exception as e:
            return ToolExecutionResult(success=False, message=f"Failed to inspect directory tree: {e}", verified=False)

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        """Verifies directory tree extraction produced valid data."""
        return result is not None and result.success and result.data is not None


class ManageWorkspaceParams(BaseModel):
    action: str = Field(
        default="list",
        description="Action: 'list', 'select', 'create', or 'open'.",
    )
    target: Optional[str] = Field(
        default=None,
        description="Workspace path (for select/open) or project name (for create).",
    )
    template: str = Field(default="empty", description="Template for 'create': empty, python, or web.")
    editor: str = Field(default="antigravity", description="Editor for 'open': antigravity or vscode.")


class ManageWorkspaceTool(BaseTool):
    """Lists, switches, creates, and opens project workspaces."""

    name = "manage_workspace"
    description = "Manages EDITH project workspaces: list, switch active workspace, create new project, or open in IDE."
    risk_tier = ActionRiskTier.LOW_RISK_REVERSIBLE
    parameters_schema = ManageWorkspaceParams

    async def execute(
        self,
        action: str = "list",
        target: Optional[str] = None,
        template: str = "empty",
        editor: str = "antigravity",
        **kwargs,
    ) -> ToolExecutionResult:
        from edith.workspace.manager import workspace_manager

        try:
            act = action.lower().strip()
            if act == "list":
                workspaces = workspace_manager.list_workspaces()
                active = workspace_manager.active_workspace
                return ToolExecutionResult(
                    success=True,
                    data={
                        "active": workspace_manager.get_workspace_info(active),
                        "workspaces": workspaces,
                    },
                    message=f"Found {len(workspaces)} workspaces. Active: {active.name if active else 'None selected'}",
                    verified=True,
                )
            elif act == "select":
                if not target:
                    return ToolExecutionResult(success=False, message="Workspace path or name is required.", verified=False)
                info = workspace_manager.set_active_workspace(target, create_if_missing=True)
                return ToolExecutionResult(
                    success=True,
                    data=info,
                    message=f"Active workspace switched to '{info['name']}' ({info['path']}).",
                    verified=True,
                )
            elif act == "create":
                if not target:
                    return ToolExecutionResult(success=False, message="New project name is required.", verified=False)
                info = workspace_manager.create_workspace(name=target, template=template)
                return ToolExecutionResult(
                    success=True,
                    data=info,
                    message=f"Created and activated workspace '{info['name']}' at {info['path']}.",
                    verified=True,
                )
            elif act == "open":
                res = workspace_manager.open_in_editor(path=target, editor=editor)
                return ToolExecutionResult(
                    success=True,
                    data=res,
                    message=f"Opened workspace in {res['editor']}: {res['path']}.",
                    verified=True,
                )
            else:
                return ToolExecutionResult(success=False, message=f"Unknown workspace action: {action}", verified=False)
        except Exception as e:
            return ToolExecutionResult(success=False, message=f"Workspace action failed: {e}", verified=False)

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        return result is not None and result.success
