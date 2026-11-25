"""
Productivity & Task Management Tools for EDITH.
Allows adding, updating, deleting, listing tasks, and scheduling reminders via voice/chat.
"""

from __future__ import annotations
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field
from sqlalchemy import select
from loguru import logger

from edith.security.permissions import ActionRiskTier
from edith.tools.base import BaseTool, ToolExecutionResult


def summarize_and_tag_task(raw_text: str) -> Tuple[str, str, str]:
    """
    Assigns a clean topic category and concise summary to a task/reminder.
    Returns (topic, short_title, summary_description).
    """
    text = " ".join((raw_text or "").strip().split())
    low = text.lower()
    topic_rules = [
        ("Meeting", ("meet", "call", "sync", "zoom", "standup", "interview", "discuss")),
        ("Dev", ("code", "bug", "fix", "deploy", "git", "pr", "api", "build", "test", "edith")),
        ("Finance", ("pay", "bill", "invoice", "bank", "tax", "budget", "salary", "rent")),
        ("Health", ("gym", "workout", "doctor", "med", "walk", "run", "sleep", "water")),
        ("Study", ("read", "learn", "study", "course", "exam", "notes", "book")),
        ("Errand", ("buy", "shop", "groceries", "order", "pickup", "deliver")),
    ]
    topic = "General"
    for label, kws in topic_rules:
        if any(k in low for k in kws):
            topic = label
            break

    short_title = text if len(text) <= 64 else text[:61].rstrip() + "..."
    tagged_title = f"[{topic}] {short_title}" if not text.startswith("[") else short_title
    summary = f"Topic: {topic} | Summary: {text}"
    return topic, tagged_title, summary


async def sync_task_to_google_calendar(
    title: str,
    description: str,
    due_date: Optional[datetime] = None,
) -> Optional[str]:
    """Creates a matching Google Calendar event when google-calendar MCP is connected."""
    try:
        from edith.mcp.manager import mcp_manager
        if mcp_manager._server_status.get("google-calendar") != "connected":
            return None
        start_dt = due_date or (datetime.utcnow() + timedelta(hours=1))
        end_dt = start_dt + timedelta(minutes=30)
        res = await mcp_manager.call_tool(
            server_id="google-calendar",
            tool_name="create-event",
            arguments={
                "calendarId": "primary",
                "summary": title,
                "description": description,
                "start": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        )
        return None if res.get("is_error") else str(res.get("output") or "Synced")
    except Exception as e:
        logger.debug(f"Google Calendar sync skipped: {e}")
        return None


async def fetch_google_calendar_events(max_days: int = 7) -> str:
    """Fetches upcoming events/reminders from Google Calendar MCP if connected."""
    try:
        from edith.mcp.manager import mcp_manager
        if mcp_manager._server_status.get("google-calendar") != "connected":
            return ""
        now = datetime.utcnow()
        res = await mcp_manager.call_tool(
            server_id="google-calendar",
            tool_name="list-events",
            arguments={
                "calendarId": "primary",
                "timeMin": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "timeMax": (now + timedelta(days=max_days)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        )
        if not res.get("is_error") and res.get("output"):
            return str(res["output"])[:1200]
    except Exception as e:
        logger.debug(f"Google Calendar fetch skipped: {e}")
    return ""


class ManageTasksParams(BaseModel):
    action: str = Field(..., description="'add', 'update', 'delete', 'list', or 'remind'")
    title: Optional[str] = Field(default=None, description="Task title or search phrase")
    status: Optional[str] = Field(default=None, description="pending, in_progress, completed, cancelled")
    priority: Optional[str] = Field(default="medium", description="low, medium, high, urgent")
    due_hint: Optional[str] = Field(default=None, description="today, tomorrow, or ISO date string")
    reminder_minutes: Optional[int] = Field(default=None, description="Minutes from now for reminder")


class ManageTasksTool(BaseTool):
    """Creates, updates, deletes, or lists scheduled tasks and reminders in SQLite."""

    name = "manage_tasks"
    description = (
        "Add, update, complete, delete, or list tasks and plans in EDITH's schedule "
        "using natural language voice or chat commands."
    )
    risk_tier = ActionRiskTier.LOW_RISK_REVERSIBLE
    parameters_schema = ManageTasksParams

    @staticmethod
    def _parse_due(due_hint: Optional[str]) -> Optional[datetime]:
        if not due_hint:
            return None
        low = due_hint.lower().strip()
        now = datetime.utcnow()
        if low == "today":
            return now.replace(hour=18, minute=0, second=0, microsecond=0)
        if low == "tomorrow":
            return (now + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        try:
            return datetime.fromisoformat(due_hint.replace("Z", "+00:00"))
        except Exception:
            return None

    @staticmethod
    async def _notify_ui():
        try:
            from edith.api.websocket import manager as ws_manager
            await ws_manager.broadcast("TASKS_UPDATED", {"refresh": True})
        except Exception:
            pass

    async def execute(
        self,
        action: str,
        title: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = "medium",
        due_hint: Optional[str] = None,
        reminder_minutes: Optional[int] = None,
        **kwargs,
    ) -> ToolExecutionResult:
        from edith.memory.database import AsyncSessionLocal
        from edith.memory.models import Task, Reminder
        from edith.productivity.scheduler import edith_scheduler

        act = action.lower().strip()
        async with AsyncSessionLocal() as db:
            if act == "add":
                if not title or not title.strip():
                    return ToolExecutionResult(success=False, message="Task title is required.", verified=False)
                topic, tagged_title, summary_desc = summarize_and_tag_task(title)
                prio = priority if priority in ("low", "medium", "high", "urgent") else "medium"
                due = self._parse_due(due_hint)
                task = Task(
                    title=tagged_title,
                    description=summary_desc,
                    priority=prio,
                    status="pending",
                    due_date=due,
                )
                db.add(task)
                await db.commit()
                await db.refresh(task)
                gcal_res = await sync_task_to_google_calendar(tagged_title, summary_desc, due)
                await self._notify_ui()
                gcal_note = " and synced to Google Calendar" if gcal_res else ""
                return ToolExecutionResult(
                    success=True,
                    data={"id": task.id, "title": task.title, "topic": topic, "priority": task.priority, "gcal_synced": bool(gcal_res)},
                    message=f"added task '{task.title}' ({prio} priority){gcal_note}.",
                    verified=True,
                )

            elif act == "update":
                if not title or not title.strip():
                    return ToolExecutionResult(success=False, message="Specify which task to update.", verified=False)
                res = await db.execute(select(Task).order_by(Task.created_at.desc()))
                tasks = res.scalars().all()
                q = title.strip().lower()
                match = next((t for t in tasks if q in t.title.lower()), None)
                if not match:
                    return ToolExecutionResult(success=False, message=f"Could not find a task matching '{title}'.", verified=False)

                if status in ("pending", "in_progress", "completed", "cancelled"):
                    match.status = status
                    if status == "completed":
                        match.completed_at = datetime.utcnow()
                if priority in ("low", "medium", "high", "urgent"):
                    match.priority = priority
                await db.commit()
                await self._notify_ui()
                return ToolExecutionResult(
                    success=True,
                    data={"id": match.id, "title": match.title, "status": match.status, "priority": match.priority},
                    message=f"updated task '{match.title}' to {match.status}.",
                    verified=True,
                )

            elif act == "delete":
                if not title or not title.strip():
                    return ToolExecutionResult(success=False, message="Specify which task to delete.", verified=False)
                res = await db.execute(select(Task).order_by(Task.created_at.desc()))
                tasks = res.scalars().all()
                q = title.strip().lower()
                match = next((t for t in tasks if q in t.title.lower()), None)
                if not match:
                    return ToolExecutionResult(success=False, message=f"Could not find task '{title}'.", verified=False)
                deleted_title = match.title
                await db.delete(match)
                await db.commit()
                await self._notify_ui()
                return ToolExecutionResult(
                    success=True,
                    data={"deleted": deleted_title},
                    message=f"removed task '{deleted_title}'.",
                    verified=True,
                )

            elif act == "list":
                res = await db.execute(select(Task).order_by(Task.created_at.desc()))
                all_tasks = res.scalars().all()
                pending = [t for t in all_tasks if t.status in ("pending", "in_progress")]
                gcal_events = await fetch_google_calendar_events()
                if not pending and not gcal_events:
                    return ToolExecutionResult(
                        success=True,
                        data={"pending": []},
                        message="you have no pending tasks or Google Calendar events scheduled right now.",
                        verified=True,
                    )
                titles = ", ".join(f"{t.title} ({t.priority})" for t in pending[:5])
                msg = f"you have {len(pending)} scheduled tasks: {titles}." if pending else "no local tasks pending."
                if gcal_events:
                    msg += f" Upcoming on Google Calendar: {gcal_events[:400]}"
                return ToolExecutionResult(
                    success=True,
                    data={"count": len(pending), "titles": [t.title for t in pending], "google_calendar": gcal_events},
                    message=msg,
                    verified=True,
                )

            elif act == "remind":
                msg = (title or "Scheduled reminder").strip()
                mins = reminder_minutes if reminder_minutes and reminder_minutes > 0 else 15
                trigger = datetime.utcnow() + timedelta(minutes=mins)
                rem = Reminder(message=msg, trigger_at=trigger)
                db.add(rem)
                await db.commit()
                await db.refresh(rem)
                try:
                    edith_scheduler.schedule_reminder(rem.id, rem.message, trigger)
                except Exception as e:
                    logger.warning(f"Reminder scheduler note: {e}")
                await self._notify_ui()
                return ToolExecutionResult(
                    success=True,
                    data={"id": rem.id, "message": rem.message, "minutes": mins},
                    message=f"reminder set for {mins} minutes from now: '{rem.message}'.",
                    verified=True,
                )

            return ToolExecutionResult(success=False, message=f"Unknown task action: {action}", verified=False)

    async def verify(self, result: Optional[ToolExecutionResult], **kwargs) -> bool:
        return result is not None and result.success
