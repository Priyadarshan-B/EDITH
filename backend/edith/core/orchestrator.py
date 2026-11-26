"""
Native AI Orchestrator & Execution Coordinator for EDITH.
Resolves tool intents, enforces security tiers, coordinates dual-channel authorization, and verifies results.
"""

from __future__ import annotations
import json
import uuid
import time
import re
from typing import Dict, Any, List, Optional, Tuple
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
        self.pending_build_prompt: Optional[str] = None
        self.pending_mcp_action: Optional[Dict[str, Any]] = None

    def detect_tool_intent(self, user_prompt: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Fast deterministic parser for common desktop commands.
        Falls back to LLM reasoning when needed.
        """
        prompt = user_prompt.strip().lower()

        # 0. If EDITH previously asked where to save a project build, treat path/folder reply as destination
        if self.pending_build_prompt:
            raw_reply = user_prompt.strip().strip('"').strip("'")
            if raw_reply.lower() in ("cancel", "nevermind", "stop", "abort"):
                self.pending_build_prompt = None
            elif (
                re.match(r"^[a-zA-Z]:[\\/]", raw_reply)
                or raw_reply.lower().startswith(("desktop\\", "desktop/", "documents\\", "documents/"))
                or re.match(r"^[a-zA-Z0-9_\-\s]{2,48}$", raw_reply)
            ):
                from edith.workspace.manager import workspace_manager
                resolved_dest = str(workspace_manager.resolve_user_path(raw_reply))
                saved_prompt = self.pending_build_prompt
                self.pending_build_prompt = None
                return "antigravity_build_project", {
                    "prompt": saved_prompt,
                    "workspace_path": resolved_dest,
                }

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

        # 10. Hardware diagnostic intent
        if any(phrase in prompt for phrase in ["diagnostic", "hardware diagnostic", "system diagnostic", "ram headroom", "cpu utilization", "compute mode"]):
            return "system_hardware_diagnostic", {"detailed": "detailed" in prompt}

        # 11. Virtual Mouse via Camera intent
        if any(phrase in prompt for phrase in ["virtual mouse", "camera mouse", "hand mouse"]):
            disable_words = ("disable", "stop", "off", "close", "deactivate")
            enabled = not any(w in prompt for w in disable_words)
            return "toggle_virtual_mouse", {"enabled": enabled}

        # 12. Workspace Management intent
        if "workspace" in prompt:
            if any(w in prompt for w in ["list", "show", "all workspaces"]):
                return "manage_workspace", {"action": "list"}
            create_ws = re.search(r"create\s+(?:new\s+)?workspace\s+([a-zA-Z0-9_\-]+)", prompt)
            if create_ws:
                return "manage_workspace", {"action": "create", "target": create_ws.group(1)}
            select_ws = re.search(r"(?:switch|select|use|change)\s+workspace\s+(?:to\s+)?([^\s]+)", prompt)
            if select_ws:
                return "manage_workspace", {"action": "select", "target": select_ws.group(1)}
            if any(w in prompt for w in ["open workspace", "open in antigravity", "open in vscode"]):
                editor = "vscode" if "vscode" in prompt else "antigravity"
                return "manage_workspace", {"action": "open", "editor": editor}

        # 13. Antigravity Project Builder intent
        agy_match = re.match(
            r"^(?:antigravity\s+)?(?:build|develop|create\s+(?:a|an)\s+(?:project|app|website|api|script))\s+(.+)$",
            prompt,
        )
        if agy_match:
            from edith.workspace.manager import workspace_manager

            # Extract optional destination path from "in <path>" / "at <path>" / "to <path>"
            loc_match = re.search(
                r"\b(?:in|at|to|inside|save\s+(?:in|to))\s+(['\"]?(?:[a-zA-Z]:[\\/][^'\"\n]+|(?:desktop|documents)[\\/][^'\"\n]+|[a-zA-Z0-9_\-]+)['\"]?)\s*$",
                user_prompt.strip(),
                re.IGNORECASE,
            )
            if loc_match:
                dest_raw = loc_match.group(1)
                resolved_dest = str(workspace_manager.resolve_user_path(dest_raw))
                return "antigravity_build_project", {
                    "prompt": user_prompt.strip(),
                    "workspace_path": resolved_dest,
                }

            active_ws = workspace_manager.active_workspace
            if active_ws is not None and active_ws.resolve() != workspace_manager.edith_root:
                return "antigravity_build_project", {
                    "prompt": user_prompt.strip(),
                    "workspace_path": str(active_ws),
                }

            # No save folder selected yet -> ask user where to save instead of writing in EDITH folder
            self.pending_build_prompt = user_prompt.strip()
            return "ask_project_save_location", {"pending_prompt": user_prompt.strip()}

        # 14. Voice & Chat Task / Reminder Management
        add_task_match = re.match(
            r"^(?:add|create|new|schedule)\s+(?:a\s+)?(?:task|plan|todo)\s+(.+)$",
            prompt,
        )
        if add_task_match:
            raw_title = user_prompt.strip().split(None, 2)[-1]
            # Strip leading 'task'/'plan'/'todo' if present
            raw_title = re.sub(r"^(?:a\s+)?(?:task|plan|todo)\s+", "", raw_title, flags=re.IGNORECASE).strip()
            prio = "medium"
            for p_kw in ("urgent", "high", "low", "medium"):
                if re.search(rf"\b{p_kw}(?:\s+priority)?\b", raw_title, re.IGNORECASE):
                    prio = p_kw
                    raw_title = re.sub(rf"\b(?:with\s+)?{p_kw}(?:\s+priority)?\b", "", raw_title, flags=re.IGNORECASE).strip()
            due_hint = None
            if re.search(r"\btomorrow\b", raw_title, re.IGNORECASE):
                due_hint = "tomorrow"
                raw_title = re.sub(r"\b(?:due\s+)?tomorrow\b", "", raw_title, flags=re.IGNORECASE).strip()
            elif re.search(r"\btoday\b", raw_title, re.IGNORECASE):
                due_hint = "today"
                raw_title = re.sub(r"\b(?:due\s+)?today\b", "", raw_title, flags=re.IGNORECASE).strip()
            return "manage_tasks", {"action": "add", "title": raw_title, "priority": prio, "due_hint": due_hint}

        update_task_match = re.match(
            r"^(?:update|mark|set|complete|finish)\s+(?:the\s+)?(?:task\s+)?(.+?)(?:\s+(?:as|to)\s+(completed|done|in[\s_]progress|pending|cancelled))?$",
            prompt,
        )
        if update_task_match and any(w in prompt for w in ("task", "complete", "finish", "in progress", "in_progress", "done", "cancelled")):
            t_title = update_task_match.group(1).strip()
            st_raw = (update_task_match.group(2) or ("completed" if prompt.startswith(("complete", "finish")) else "in_progress")).replace(" ", "_")
            if st_raw == "done":
                st_raw = "completed"
            return "manage_tasks", {"action": "update", "title": t_title, "status": st_raw}

        del_task_match = re.match(r"^(?:delete|remove|cancel)\s+(?:the\s+)?(?:task|plan)\s+(.+)$", prompt)
        if del_task_match:
            return "manage_tasks", {"action": "delete", "title": del_task_match.group(1).strip()}

        if any(phrase in prompt for phrase in ["my tasks", "my plans", "scheduled tasks", "scheduled plans", "list tasks", "what are my plans"]):
            return "manage_tasks", {"action": "list"}

        remind_match = re.match(r"^remind\s+me\s+(?:in\s+(\d+)\s+min(?:ute)?s?\s+)?(?:to\s+)?(.+)$", prompt)
        if remind_match:
            mins = int(remind_match.group(1)) if remind_match.group(1) else 15
            return "manage_tasks", {"action": "remind", "title": remind_match.group(2).strip(), "reminder_minutes": mins}

        # 15. Built-in MCP Quick Notes, Web Fetch, and Code Diff intents
        note_match = re.match(r"^(?:save|add|create)\s+(?:a\s+)?(?:quick\s+)?note\s+(.+)$", prompt)
        if note_match:
            body = user_prompt.strip().split("note", 1)[-1].strip()
            return "invoke_mcp_tool", {
                "server_id": "edith-core-mcp",
                "tool_name": "save_quick_note",
                "arguments": {"title": body[:36], "content": body},
            }

        if any(phrase in prompt for phrase in ["list notes", "my notes", "show notes", "quick notes"]):
            return "invoke_mcp_tool", {
                "server_id": "edith-core-mcp",
                "tool_name": "list_quick_notes",
                "arguments": {"limit": 10},
            }

        fetch_match = re.search(r"(https?://\S+)", user_prompt)
        if fetch_match and any(w in prompt for w in ("fetch", "read", "summarize", "open url", "check url")):
            return "invoke_mcp_tool", {
                "server_id": "edith-core-mcp",
                "tool_name": "fetch_webpage_text",
                "arguments": {"url": fetch_match.group(1)},
            }

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

    @staticmethod
    def _is_mutating_mcp_tool(tool_name: str) -> bool:
        """Returns True for side-effecting MCP tools that should confirm before executing."""
        low = tool_name.lower()
        read_prefixes = ("get_", "list_", "search_", "read_", "fetch_", "query_", "find_", "check_", "view_", "show_", "resolve_")
        if low.startswith(read_prefixes):
            return False
        mutating_tokens = (
            "send", "create", "update", "delete", "remove", "write", "add",
            "insert", "modify", "post", "reply", "draft", "comment", "merge",
            "close", "archive", "trash", "drop", "alter", "push",
        )
        return any(tok in low for tok in mutating_tokens)

    @staticmethod
    def _extract_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
        text = raw_text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            obj = json.loads(text[start:end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None

    async def plan_mcp_action(
        self,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Automatically selects an appropriate connected MCP server & tool from natural-language
        input, or asks the user a clarifying/confirmation question before proceeding.
        """
        from edith.mcp.manager import mcp_manager
        from edith.providers.manager import model_manager

        low = user_prompt.strip().lower()

        # 1. Handle pending confirmation or clarification follow-up
        effective_prompt = user_prompt.strip()
        if self.pending_mcp_action:
            pending = self.pending_mcp_action
            if low in ("cancel", "no", "nope", "stop", "abort", "nevermind", "skip", "don't", "dont"):
                self.pending_mcp_action = None
                return {"action": "cancelled"}

            if pending.get("awaiting_confirmation") and low in (
                "yes", "yeah", "yep", "confirm", "proceed", "ok", "okay", "do it", "go ahead", "sure", "send", "run"
            ):
                self.pending_mcp_action = None
                return {
                    "action": "execute",
                    "server_id": pending["server_id"],
                    "tool_name": pending["tool_name"],
                    "arguments": pending.get("arguments") or {},
                }

            # User replied with clarifying details -> combine with original request
            orig = pending.get("original_prompt", "")
            partial = pending.get("arguments") or {}
            effective_prompt = (
                f"Original request: {orig}\n"
                f"Partial arguments so far: {json.dumps(partial)}\n"
                f"User's clarification: {user_prompt.strip()}"
            )
            self.pending_mcp_action = None

        # Skip pure greetings / trivial chitchat and non-tool conversational prompts
        conversational_only = (
            "hi", "hello", "hey", "thanks", "thank you", "ok", "okay",
            "bye", "good morning", "good afternoon", "good evening", "good night",
            "how are you", "who are you", "what can you do", "help me with",
        )
        if low in conversational_only or (
            any(p in low for p in ("how are you", "what can you help", "who are you", "tell me a joke"))
            and len(low.split()) <= 16
        ):
            return {"action": "none"}

        catalog = mcp_manager.get_connected_tools_catalog()
        if not catalog:
            return {"action": "none"}

        # Fast keyword pre-filter: only invoke the MCP router LLM when the prompt
        # plausibly relates to an external tool/MCP capability (avoids slow blocking LLM call on normal chat).
        mcp_trigger_keywords = (
            "search", "web", "google", "duckduckgo", "look up", "lookup", "find online",
            "news", "latest", "weather", "docs", "documentation", "library", "api",
            "github", "repo", "repository", "issue", "pull request", "commit",
            "email", "gmail", "mail", "send", "inbox", "calendar", "meeting", "event",
            "sqlite", "database", "sql", "table", "query", "row",
            "remember", "memory", "knowledge", "save note", "recall",
            "mcp", "tool", "think step", "analyze deeply",
        )
        tool_name_tokens = {
            part
            for srv in catalog
            for t in srv.get("tools", [])
            for part in (srv.get("server_id", "").lower(), t.get("name", "").lower().replace("_", " "))
            if len(part) >= 4
        }
        if not any(kw in low for kw in mcp_trigger_keywords) and not any(tok in low for tok in tool_name_tokens):
            return {"action": "none"}

        valid_tools = {
            (srv["server_id"], t["name"])
            for srv in catalog
            for t in srv["tools"]
        }

        system_msg = {
            "role": "system",
            "content": (
                "You are EDITH's automatic MCP tool router. Given the user's request and the connected MCP tools, "
                "choose the best matching MCP server & tool automatically — the user will NOT name the MCP server.\n"
                "Respond with ONLY a single JSON object (no markdown, no extra text) in one of these 3 formats:\n"
                '1) {"action": "none"}  (if normal conversation / general knowledge that does NOT need any MCP tool)\n'
                '2) {"action": "ask", "question": "<clear concise question>", "server_id": "<id>", "tool_name": "<tool>", "arguments": {<known args>}}  '
                "(if an MCP tool fits, but required info is missing or ambiguous — e.g., missing email recipient, date/time, repo, or search target)\n"
                '3) {"action": "call", "server_id": "<id>", "tool_name": "<tool>", "arguments": {<args>}}  '
                "(if you have enough info to call the tool)\n\n"
                f"Connected MCP Catalog:\n{json.dumps(catalog)}"
            ),
        }

        recent_ctx = (conversation_history or [])[-4:]
        router_messages = [system_msg] + recent_ctx + [{"role": "user", "content": effective_prompt}]

        try:
            raw = await model_manager.generate_with_fallback(
                router_messages,
                temperature=0.1,
                max_tokens=450,
            )
        except Exception as e:
            logger.warning(f"MCP router LLM call failed: {e}")
            return {"action": "none"}

        decision = self._extract_json_object(raw)
        if not decision:
            return {"action": "none"}

        act = str(decision.get("action", "none")).lower()
        if act == "ask":
            question = str(decision.get("question") or "").strip()
            if not question:
                return {"action": "none"}
            self.pending_mcp_action = {
                "original_prompt": effective_prompt,
                "server_id": decision.get("server_id", ""),
                "tool_name": decision.get("tool_name", ""),
                "arguments": decision.get("arguments") or {},
                "awaiting_confirmation": False,
            }
            return {"action": "ask", "question": question}

        if act == "call":
            sid = str(decision.get("server_id") or "").strip()
            tname = str(decision.get("tool_name") or "").strip()
            args = decision.get("arguments") if isinstance(decision.get("arguments"), dict) else {}
            if (sid, tname) not in valid_tools:
                return {"action": "none"}

            if self._is_mutating_mcp_tool(tname):
                self.pending_mcp_action = {
                    "original_prompt": effective_prompt,
                    "server_id": sid,
                    "tool_name": tname,
                    "arguments": args,
                    "awaiting_confirmation": True,
                }
                args_preview = json.dumps(args) if args else "{}"
                return {
                    "action": "ask",
                    "question": (
                        f"Sir, I'm ready to run **{tname}** on `{sid}` with:\n"
                        f"`{args_preview}`\n\nShould I proceed? (yes / cancel)"
                    ),
                }

            return {
                "action": "execute",
                "server_id": sid,
                "tool_name": tname,
                "arguments": args,
            }

        return {"action": "none"}


# Global orchestrator singleton
orchestrator = NativeOrchestrator()

