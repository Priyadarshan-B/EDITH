"""
Native AI Orchestrator & Execution Coordinator for EDITH.
Resolves tool intents, enforces security tiers, coordinates dual-channel authorization, and verifies results.
"""

from __future__ import annotations
import uuid
import time
import re
from typing import Dict, Any, Optional, Tuple
from loguru import logger

from edith.security.permissions import (
    ActionRiskTier,
    AuthorizationMode,
    PendingAction,
)
from edith.security.audit import AuditLogger
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.tools.registry import tool_registry


class NativeOrchestrator:
    def __init__(self):
        self.pending_actions: Dict[str, PendingAction] = {}

    def detect_tool_intent(self, user_prompt: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Fast deterministic parser for common desktop commands.
        Falls back to LLM reasoning when needed.
        """
        prompt = user_prompt.strip().lower()

        # 1. Launch application intent
        launch_match = re.match(r"^(?:open|launch|start|run)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+app|\s+application)?$", prompt)
        if launch_match:
            target = launch_match.group(1).strip()
            # If target looks like a terminal command or script, route to terminal
            if target.startswith(("git", "npm", "pip", "python", "cargo")):
                return "execute_terminal_command", {"command": user_prompt}
            return "launch_application", {"app_name": target}

        # 2. Active window intent
        if any(phrase in prompt for phrase in ["active window", "current window", "foreground window"]):
            return "get_active_window", {}

        # 3. List processes intent
        if any(phrase in prompt for phrase in ["running apps", "running processes", "list processes", "list apps"]):
            return "list_running_applications", {"limit": 15}

        # 4. Search files intent
        search_match = re.search(r"(?:search|find)\s+(?:files?|for)\s+['\"]?([^'\"\s]+)['\"]?", prompt)
        if search_match:
            pattern = search_match.group(1)
            return "search_files", {"directory": ".", "pattern": f"*{pattern}*"}

        # 5. Read file intent
        read_match = re.search(r"(?:read|show|view|cat)\s+(?:file\s+)?['\"]?([^'\"\s]+\.[a-zA-Z0-9]+)['\"]?", prompt)
        if read_match:
            filepath = read_match.group(1)
            return "read_file", {"file_path": filepath}

        # 6. Delete file intent (Destructive)
        del_match = re.search(r"(?:delete|remove|rm)\s+(?:file\s+)?['\"]?([^'\"\s]+\.[a-zA-Z0-9]+)['\"]?", prompt)
        if del_match:
            filepath = del_match.group(1)
            return "delete_file_or_directory", {"target_path": filepath}

        # 7. Explicit terminal command
        if prompt.startswith(("run terminal", "exec ", "cmd ", "shell ")):
            cmd = user_prompt.split(" ", 2)[-1]
            return "execute_terminal_command", {"command": cmd}

        # 8. Git status inspection
        if any(phrase in prompt for phrase in ["git status", "git branch", "git changes", "check git"]):
            return "git_status_inspect", {"repo_path": "."}

        # 9. Directory tree inspection
        if any(phrase in prompt for phrase in ["directory tree", "folder tree", "project tree", "tree view", "show project structure"]):
            return "directory_tree_inspect", {"root_dir": ".", "max_depth": 3}

        return None

    async def execute_or_request_authorization(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        source: str = "text",
    ) -> Dict[str, Any]:
        """
        Evaluates tool risk tier and either executes immediately or registers pending authorization.
        """
        tool = tool_registry.get_tool(tool_name)
        if not tool:
            return {
                "status": "error",
                "message": f"Unknown tool: '{tool_name}'.",
            }

        risk_tier = tool.risk_tier

        # Tier 1 & 2: Read-Only and Low-Risk Reversible -> Auto-execute
        if risk_tier in [ActionRiskTier.READ_ONLY, ActionRiskTier.LOW_RISK_REVERSIBLE]:
            exec_res = await tool.execute(**parameters)
            status_str = "success" if exec_res.success else "failed"

            # Record audit log
            await AuditLogger.log_action(
                action_name=tool_name,
                risk_tier=risk_tier,
                authorization_mode=AuthorizationMode.AUTO,
                parameters=parameters,
                status=status_str,
            )

            return {
                "status": "completed",
                "result": exec_res.model_dump(),
                "risk_tier": risk_tier.value,
                "verified": exec_res.verified,
                "summary": exec_res.message,
            }

        # Tier 3: Sensitive (Requires Spoken Confirmation)
        elif risk_tier == ActionRiskTier.SENSITIVE:
            action_id = str(uuid.uuid4())
            pending = PendingAction(
                action_id=action_id,
                tool_name=tool_name,
                risk_tier=risk_tier,
                parameters=parameters,
                description=f"Action '{tool_name}' requires confirmation.",
                requires_gui_modal=False,
                requires_voice_confirmation=True,
                confirmation_phrase="Confirm proceed",
                created_at=time.time(),
            )
            self.pending_actions[action_id] = pending

            return {
                "status": "requires_voice_confirmation",
                "action_id": action_id,
                "tool_name": tool_name,
                "parameters": parameters,
                "prompt": "This action mutates workspace data. Say 'Confirm proceed' or authorize in the HUD.",
                "confirmation_phrase": "Confirm proceed",
            }

        # Tier 4: Destructive / Privileged (Requires GUI Modal with parameter diff)
        elif risk_tier == ActionRiskTier.DESTRUCTIVE_PRIVILEGED:
            action_id = str(uuid.uuid4())
            pending = PendingAction(
                action_id=action_id,
                tool_name=tool_name,
                risk_tier=risk_tier,
                parameters=parameters,
                description=f"Destructive action: '{tool_name}'.",
                requires_gui_modal=True,
                requires_voice_confirmation=False,
                created_at=time.time(),
            )
            self.pending_actions[action_id] = pending

            return {
                "status": "requires_gui_authorization",
                "action_id": action_id,
                "tool_name": tool_name,
                "parameters": parameters,
                "risk_tier": "destructive_privileged",
                "prompt": f"Security boundary hold: Authorize '{tool_name}' via the GUI modal.",
            }

        return {"status": "error", "message": "Unhandled risk classification."}

    async def resolve_authorization(
        self,
        action_id: str,
        approved: bool,
        mode: AuthorizationMode = AuthorizationMode.GUI_MODAL_CONFIRMED,
    ) -> Dict[str, Any]:
        """Resolves a pending authorization challenge from the user."""
        pending = self.pending_actions.pop(action_id, None)
        if not pending:
            return {
                "status": "error",
                "message": f"Pending action '{action_id}' not found or expired.",
            }

        tool = tool_registry.get_tool(pending.tool_name)
        if not tool:
            return {"status": "error", "message": f"Tool '{pending.tool_name}' not available."}

        if not approved:
            await AuditLogger.log_action(
                action_name=pending.tool_name,
                risk_tier=pending.risk_tier,
                authorization_mode=AuthorizationMode.DENIED,
                parameters=pending.parameters,
                status="rejected",
            )
            return {
                "status": "aborted",
                "message": f"Action '{pending.tool_name}' was denied by operator.",
            }

        # User approved -> Execute tool and verify
        exec_res = await tool.execute(**pending.parameters)
        status_str = "success" if exec_res.success else "failed"

        await AuditLogger.log_action(
            action_name=pending.tool_name,
            risk_tier=pending.risk_tier,
            authorization_mode=mode,
            parameters=pending.parameters,
            status=status_str,
        )

        return {
            "status": "completed",
            "result": exec_res.model_dump(),
            "verified": exec_res.verified,
            "summary": exec_res.message,
        }


# Global orchestrator singleton
orchestrator = NativeOrchestrator()

