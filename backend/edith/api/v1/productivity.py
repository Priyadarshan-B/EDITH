"""
Personal Productivity, Tasks, Reminders, and Daily Briefing API for EDITH.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from edith.memory.database import get_db_session
from edith.memory.models import Task, Reminder
from edith.productivity.scheduler import edith_scheduler
from edith.config import settings

router = APIRouter(prefix="/productivity", tags=["Productivity & Daily Briefing"])


# --- Schemas ---

class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = Field(default="medium", description="low, medium, high, urgent")
    due_date: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = Field(None, description="pending, in_progress, completed, cancelled")
    priority: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    created_at: str
    completed_at: Optional[str] = None


class ReminderCreateRequest(BaseModel):
    message: str = Field(..., min_length=1)
    trigger_at: str = Field(..., description="ISO 8601 UTC timestamp")
    task_id: Optional[str] = None


class ReminderResponse(BaseModel):
    id: str
    task_id: Optional[str]
    message: str
    trigger_at: str
    is_acknowledged: bool
    created_at: str


class DailyBriefingResponse(BaseModel):
    generated_at: str
    total_tasks: int
    pending_tasks: int
    completed_tasks: int
    high_priority_tasks: List[TaskResponse]
    upcoming_reminders: List[ReminderResponse]
    spoken_summary: str


# --- Endpoints ---

@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """Lists tasks with optional status and priority filters."""
    query = select(Task).order_by(Task.created_at.desc())
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)

    res = await db.execute(query)
    tasks = res.scalars().all()
    return [
        TaskResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            due_date=t.due_date.isoformat() if t.due_date else None,
            created_at=t.created_at.isoformat(),
            completed_at=t.completed_at.isoformat() if t.completed_at else None,
        )
        for t in tasks
    ]


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    payload: TaskCreateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Creates a new task in SQLite."""
    due = None
    if payload.due_date:
        try:
            due = datetime.fromisoformat(payload.due_date.replace("Z", "+00:00"))
        except Exception:
            pass

    task = Task(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status="pending",
        due_date=due,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date.isoformat() if task.due_date else None,
        created_at=task.created_at.isoformat(),
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Updates an existing task's status, priority, or title."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status
        if payload.status == "completed":
            task.completed_at = datetime.utcnow()
        else:
            task.completed_at = None
    if payload.priority is not None:
        task.priority = payload.priority

    await db.commit()
    await db.refresh(task)

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date.isoformat() if task.due_date else None,
        created_at=task.created_at.isoformat(),
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Deletes a task and its associated reminders."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    await db.delete(task)
    await db.commit()
    return {"status": "success", "message": f"Task '{task_id}' deleted."}


@router.get("/reminders", response_model=List[ReminderResponse])
async def list_reminders(
    db: AsyncSession = Depends(get_db_session),
):
    """Lists all active and scheduled reminders."""
    query = select(Reminder).order_by(Reminder.trigger_at.asc())
    res = await db.execute(query)
    reminders = res.scalars().all()

    return [
        ReminderResponse(
            id=r.id,
            task_id=r.task_id,
            message=r.message,
            trigger_at=r.trigger_at.isoformat(),
            is_acknowledged=r.is_acknowledged,
            created_at=r.created_at.isoformat(),
        )
        for r in reminders
    ]


@router.post("/reminders", response_model=ReminderResponse)
async def create_reminder(
    payload: ReminderCreateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Schedules a new reminder with APScheduler."""
    try:
        trigger_dt = datetime.fromisoformat(payload.trigger_at.replace("Z", "+00:00"))
        # Strip timezone info for consistent naive UTC comparison if needed
        if trigger_dt.tzinfo is not None:
            trigger_dt = trigger_dt.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_at timestamp: {e}")

    task_title = None
    if payload.task_id:
        task = await db.get(Task, payload.task_id)
        if task:
            task_title = task.title

    reminder = Reminder(
        task_id=payload.task_id,
        message=payload.message,
        trigger_at=trigger_dt,
        is_acknowledged=False,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    # Enqueue in APScheduler
    edith_scheduler.schedule_reminder(
        reminder_id=reminder.id,
        trigger_at=reminder.trigger_at,
        message=reminder.message,
        task_title=task_title,
    )

    return ReminderResponse(
        id=reminder.id,
        task_id=reminder.task_id,
        message=reminder.message,
        trigger_at=reminder.trigger_at.isoformat(),
        is_acknowledged=reminder.is_acknowledged,
        created_at=reminder.created_at.isoformat(),
    )


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Cancels and deletes a reminder."""
    reminder = await db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found.")

    edith_scheduler.cancel_reminder(reminder_id)
    await db.delete(reminder)
    await db.commit()
    return {"status": "success", "message": f"Reminder '{reminder_id}' cancelled."}


@router.get("/daily-summary", response_model=DailyBriefingResponse)
async def get_daily_briefing(
    db: AsyncSession = Depends(get_db_session),
):
    """Generates a cohesive daily briefing synthesis for HUD and voice output."""
    tasks_res = await db.execute(select(Task))
    all_tasks = tasks_res.scalars().all()

    pending = [t for t in all_tasks if t.status in ("pending", "in_progress")]
    completed = [t for t in all_tasks if t.status == "completed"]
    urgent = [t for t in pending if t.priority in ("high", "urgent")]

    now = datetime.utcnow()
    reminders_res = await db.execute(
        select(Reminder).where(Reminder.is_acknowledged == False).order_by(Reminder.trigger_at.asc())
    )
    upcoming_rems = reminders_res.scalars().all()

    # Formulate natural spoken summary with time-of-day Boss greeting and scheduled plan titles
    local_hour = datetime.now().hour
    if local_hour < 12:
        greeting = "Good morning"
    elif local_hour < 17:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    user_title = settings.user.title or "Boss"
    spoken = f"{greeting}, {user_title}. All EDITH systems are online."
    if pending:
        top_titles = ", ".join(t.title for t in pending[:3])
        spoken += f" You have {len(pending)} scheduled plan{'s' if len(pending) != 1 else ''} in your tasks: {top_titles}."
        if urgent:
            spoken += f" {len(urgent)} marked as high priority."
    else:
        spoken += " Your task schedule is clear right now."

    if upcoming_rems:
        next_rem = upcoming_rems[0].message
        spoken += f" You also have {len(upcoming_rems)} upcoming reminder{'s' if len(upcoming_rems) != 1 else ''}, next up: {next_rem}."

    return DailyBriefingResponse(
        generated_at=now.isoformat(),
        total_tasks=len(all_tasks),
        pending_tasks=len(pending),
        completed_tasks=len(completed),
        high_priority_tasks=[
            TaskResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                status=t.status,
                priority=t.priority,
                due_date=t.due_date.isoformat() if t.due_date else None,
                created_at=t.created_at.isoformat(),
                completed_at=t.completed_at.isoformat() if t.completed_at else None,
            )
            for t in urgent
        ],
        upcoming_reminders=[
            ReminderResponse(
                id=r.id,
                task_id=r.task_id,
                message=r.message,
                trigger_at=r.trigger_at.isoformat(),
                is_acknowledged=r.is_acknowledged,
                created_at=r.created_at.isoformat(),
            )
            for r in upcoming_rems[:5]
        ],
        spoken_summary=spoken,
    )
