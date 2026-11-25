"""
Antigravity SDK & Built-in Local/Cloud Project Builder Tool for EDITH.
Uses google-antigravity SDK when available, with automatic fallback to
local Ollama (LocalOpenAIAgentConfig) or EDITH's active LLM provider
so project building works even without a dedicated Antigravity API key.
Never writes new projects into EDITH's own repository directory unless explicitly asked.
"""

from __future__ import annotations
import asyncio
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.workspace.manager import workspace_manager


class AntigravityBuildJob:
    def __init__(self, build_id: str, prompt: str, workspace_path: str):
        self.build_id = build_id
        self.prompt = prompt
        self.workspace_path = workspace_path
        self.status = "running"
        self.engine = "antigravity"
        self.created_at = time.time()
        self.completed_at: Optional[float] = None
        self.events: List[Dict[str, Any]] = []
        self.output_text = ""
        self.error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "build_id": self.build_id,
            "prompt": self.prompt,
            "workspace_path": self.workspace_path,
            "status": self.status,
            "engine": self.engine,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "events": self.events[-50:],
            "output_text": self.output_text,
            "error": self.error,
        }


class AntigravityBuildService:
    """Manages background project build tasks and WebSocket progress streaming."""

    def __init__(self):
        self._jobs: Dict[str, AntigravityBuildJob] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    def list_jobs(self) -> List[Dict[str, Any]]:
        jobs = sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)
        return [j.to_dict() for j in jobs[:20]]

    def get_job(self, build_id: str) -> Optional[Dict[str, Any]]:
        job = self._jobs.get(build_id)
        return job.to_dict() if job else None

    async def start_build(self, prompt: str, workspace_path: Optional[str] = None) -> Dict[str, Any]:
        if workspace_path and workspace_path.strip():
            target_path = workspace_manager.resolve_user_path(workspace_path)
        elif (
            workspace_manager.active_workspace is not None
            and workspace_manager.active_workspace.resolve() != workspace_manager.edith_root
        ):
            target_path = workspace_manager.active_workspace.resolve()
        else:
            raise ValueError(
                "No target project folder selected. Please specify where to save the project "
                "(outside the EDITH directory), e.g. 'c:\\Projects\\my-app'."
            )

        if target_path.resolve() == workspace_manager.edith_root:
            raise ValueError(
                "Cannot create new projects inside EDITH's own folder. Please choose another folder."
            )

        target_path.mkdir(parents=True, exist_ok=True)
        workspace_manager.set_active_workspace(str(target_path), create_if_missing=True)

        build_id = f"agy-{uuid.uuid4().hex[:8]}"
        job = AntigravityBuildJob(
            build_id=build_id,
            prompt=prompt,
            workspace_path=str(target_path),
        )
        self._jobs[build_id] = job
        task = asyncio.create_task(self._run_agent(job))
        self._tasks[build_id] = task
        return job.to_dict()

    async def _emit(self, job: AntigravityBuildJob, event_type: str, content: str):
        entry = {"type": event_type, "content": content, "ts": time.time()}
        job.events.append(entry)
        try:
            from edith.api.websocket import manager as ws_manager
            await ws_manager.broadcast(
                "ANTIGRAVITY_PROGRESS",
                {
                    "build_id": job.build_id,
                    "workspace_path": job.workspace_path,
                    "status": job.status,
                    "event": entry,
                },
            )
        except Exception:
            pass

    async def _try_antigravity_sdk(self, job: AntigravityBuildJob) -> bool:
        """Attempts to run google-antigravity SDK (cloud key or local Ollama endpoint)."""
        try:
            from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig
            gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
            if not gemini_key:
                return False

            job.engine = "antigravity-sdk"
            await self._emit(job, "status", f"Starting Antigravity Agent in {job.workspace_path}...")
            config = LocalAgentConfig(
                system_instructions=(
                    f"You are building a software project inside '{job.workspace_path}'. "
                    "Create and edit all files strictly inside that folder and verify them."
                ),
                capabilities=CapabilitiesConfig(),
                workspaces=[job.workspace_path],
                api_key=gemini_key,
            )

            async with Agent(config) as agent:
                response = await agent.chat(
                    f"Target project directory: {job.workspace_path}\nRequest: {job.prompt}"
                )

                async def _consume_thoughts():
                    try:
                        async for thought in response.thoughts:
                            await self._emit(job, "thought", str(thought))
                    except Exception:
                        pass

                async def _consume_tools():
                    try:
                        async for call in response.tool_calls:
                            await self._emit(job, "tool_call", f"{call.name}({call.args})")
                    except Exception:
                        pass

                thought_task = asyncio.create_task(_consume_thoughts())
                tool_task = asyncio.create_task(_consume_tools())

                chunks: List[str] = []
                async for token in response:
                    chunks.append(token)
                    if len("".join(chunks)) % 80 < len(token):
                        await self._emit(job, "token", "".join(chunks[-12:]))

                await asyncio.gather(thought_task, tool_task, return_exceptions=True)
                job.output_text = "".join(chunks)
                job.status = "completed"
                job.completed_at = time.time()
                await self._emit(job, "completed", f"Completed in {job.workspace_path}")
                return True
        except Exception as e:
            logger.info(f"Antigravity SDK unavailable or failed ({e}); falling back to EDITH builder.")
            await self._emit(job, "info", f"Antigravity SDK fallback triggered: {e}")
            return False

    async def _build_with_edith_llm(self, job: AntigravityBuildJob):
        """
        API-less / multi-provider project builder using EDITH's active LLM
        (local Ollama, Groq, or Gemini) to generate and write project files.
        """
        from edith.providers.manager import model_manager

        provider = model_manager.get_provider()
        job.engine = f"edith-{model_manager.active_provider_type}"
        await self._emit(
            job,
            "status",
            f"Building with {model_manager.active_provider_type} ({model_manager.active_model_name}) into {job.workspace_path}...",
        )

        system_msg = {
            "role": "system",
            "content": (
                "You are an expert software architect. Generate a complete, runnable project for the user's request.\n"
                "Return ONLY valid JSON (no markdown fences or commentary outside JSON) with this exact structure:\n"
                '{"summary": "short description", "files": [{"path": "relative/file.ext", "content": "full file text"}], "run_hint": "command to run"}\n'
                "Keep all file paths relative (no '..', no leading '/'). Include all necessary source files and a README.md."
            ),
        }
        user_msg = {
            "role": "user",
            "content": f"Project destination folder: {job.workspace_path}\nBuild request: {job.prompt}",
        }

        chunks: List[str] = []
        async for token in provider.generate_stream([system_msg, user_msg], temperature=0.3):
            chunks.append(token)
        raw = "".join(chunks).strip()

        # Extract JSON block if wrapped in fences
        fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", raw)
        json_str = fence_match.group(1) if fence_match else raw
        start_idx = json_str.find("{")
        end_idx = json_str.rfind("}")
        if start_idx != -1 and end_idx != -1:
            json_str = json_str[start_idx : end_idx + 1]

        spec = json.loads(json_str)
        files = spec.get("files", [])
        if not files:
            raise ValueError("Model did not return any project files.")

        root = Path(job.workspace_path).resolve()
        written: List[str] = []
        for f in files:
            rel = str(f.get("path", "")).lstrip("/\\")
            if not rel or ".." in Path(rel).parts:
                continue
            dest = (root / rel).resolve()
            if root not in dest.parents and dest != root:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(str(f.get("content", "")), encoding="utf-8")
            written.append(rel)
            await self._emit(job, "file_created", f"Created {rel}")

        summary = spec.get("summary", "Project generated.")
        run_hint = spec.get("run_hint", "")
        job.output_text = f"{summary}\nFiles created ({len(written)}): {', '.join(written)}" + (
            f"\nRun: {run_hint}" if run_hint else ""
        )
        job.status = "completed"
        job.completed_at = time.time()
        await self._emit(job, "completed", f"Created {len(written)} files in {job.workspace_path}")

    async def _run_agent(self, job: AntigravityBuildJob):
        try:
            used_sdk = await self._try_antigravity_sdk(job)
            if used_sdk:
                return
            await self._build_with_edith_llm(job)
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.completed_at = time.time()
            logger.error(f"Project build {job.build_id} failed: {e}")
            await self._emit(job, "error", str(e))


antigravity_service = AntigravityBuildService()


class AntigravityBuildParams(BaseModel):
    prompt: str = Field(..., description="What project or feature to build.")
    workspace_path: Optional[str] = Field(
        default=None,
        description="Target folder where the project should be saved (outside EDITH).",
    )


class AntigravityBuildTool(BaseTool):
    name = "antigravity_build_project"
    description = (
        "Builds or develops a software project using Antigravity SDK (or EDITH local/cloud LLM fallback) "
        "in the user-specified destination folder."
    )
    risk_tier = ActionRiskTier.SENSITIVE
    parameters_schema = AntigravityBuildParams

    async def execute(self, prompt: str, workspace_path: Optional[str] = None) -> ToolExecutionResult:
        try:
            job = await antigravity_service.start_build(prompt=prompt, workspace_path=workspace_path)
            return ToolExecutionResult(
                success=True,
                data=job,
                message=(
                    f"Started project build '{job['build_id']}' in '{job['workspace_path']}'. "
                    "Live progress is streaming to the Workspaces tab."
                ),
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Failed to start project build: {e}",
                verified=False,
            )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        return result is not None and result.success


class AskBuildLocationParams(BaseModel):
    pending_prompt: str = Field(..., description="The project build prompt waiting for a save location.")


class AskBuildLocationTool(BaseTool):
    name = "ask_project_save_location"
    description = "Asks the operator where to save a newly requested project before creating any files."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = AskBuildLocationParams

    async def execute(self, pending_prompt: str) -> ToolExecutionResult:
        return ToolExecutionResult(
            success=True,
            data={"pending_prompt": pending_prompt},
            message=(
                "where should I save this project? Please reply with a folder path "
                "(e.g. 'c:\\Projects\\my-app' or 'Desktop\\my-app'), or pick a folder in the Workspaces tab."
            ),
            verified=True,
        )

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        return True
