"""
Task Scheduling & Reminder Engine for EDITH.
Powered by APScheduler AsyncIOScheduler with persistent SQLite backup and WebSocket broadcasts.
"""

from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select

from edith.memory.database import get_async_session
from edith.memory.models import Reminder, Task
from edith.productivity.notifications import toast_notifier
from edith.api.websocket import manager as ws_manager


class EdithScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False

    def start(self):
        """Starts the background AsyncIO scheduler."""
        if not self.is_running or not self.scheduler.running:
            try:
                # Re-instantiate if event loop has been closed or reset
                loop = getattr(self.scheduler, "_eventloop", None)
                if loop is not None and loop.is_closed():
                    self.scheduler = AsyncIOScheduler()
                self.scheduler.start()
                self.is_running = True
                logger.info("EDITH APScheduler engine started.")
            except Exception as e:
                logger.debug(f"Scheduler start notice: {e}")

    def shutdown(self):
        """Gracefully halts active scheduled jobs."""
        if self.is_running:
            try:
                self.scheduler.shutdown(wait=False)
                logger.info("EDITH APScheduler engine stopped.")
            except Exception as e:
                logger.debug(f"Scheduler shutdown notice: {e}")
            finally:
                self.is_running = False

    async def _on_reminder_triggered(self, reminder_id: str, message: str, task_title: Optional[str] = None):
        """Callback invoked when a scheduled reminder triggers."""
        logger.info(f"⚡ REMINDER TRIGGERED: [{task_title or 'General'}] {message}")

        # 1. Update SQLite record
        try:
            async with get_async_session() as session:
                stmt = select(Reminder).where(Reminder.id == reminder_id)
                res = await session.execute(stmt)
                reminder = res.scalar_one_or_none()
                if reminder:
                    reminder.is_acknowledged = True
                    await session.commit()
        except Exception as e:
            logger.error(f"Error marking reminder acknowledged in SQLite: {e}")

        # 2. Dispatch Windows OS Toast Notification
        title = f"EDITH: {task_title}" if task_title else "EDITH Reminder"
        await toast_notifier.send_toast(title, message)

        # 3. Broadcast real-time event to Frontend HUD over WebSocket
        await ws_manager.broadcast("REMINDER_TRIGGERED", {
            "reminder_id": reminder_id,
            "title": task_title or "Reminder",
            "message": message,
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        })

    def schedule_reminder(
        self,
        reminder_id: str,
        trigger_at: datetime,
        message: str,
        task_title: Optional[str] = None,
    ) -> bool:
        """Schedules a one-off date trigger for a reminder."""
        if not self.is_running:
            self.start()

        # If trigger time is in the past, fire immediately
        now = datetime.utcnow()
        if trigger_at <= now:
            asyncio.create_task(self._on_reminder_triggered(reminder_id, message, task_title))
            return True

        job_id = f"reminder_{reminder_id}"
        try:
            self.scheduler.add_job(
                func=self._on_reminder_triggered,
                trigger=DateTrigger(run_date=trigger_at),
                args=[reminder_id, message, task_title],
                id=job_id,
                replace_existing=True,
            )
            logger.info(f"Scheduled reminder '{job_id}' for {trigger_at.isoformat()}.")
            return True
        except Exception as e:
            logger.error(f"Failed to schedule reminder job: {e}")
            return False

    def cancel_reminder(self, reminder_id: str) -> bool:
        """Removes a scheduled reminder from the active queue."""
        job_id = f"reminder_{reminder_id}"
        try:
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)
                logger.info(f"Cancelled reminder job '{job_id}'.")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel reminder job: {e}")
            return False

    async def load_pending_from_db(self):
        """Scans database on startup and enqueues future reminders."""
        try:
            async with get_async_session() as session:
                now = datetime.utcnow()
                stmt = select(Reminder).where(
                    Reminder.is_acknowledged == False,
                    Reminder.trigger_at > now,
                )
                res = await session.execute(stmt)
                pending = res.scalars().all()

                for rem in pending:
                    self.schedule_reminder(
                        reminder_id=rem.id,
                        trigger_at=rem.trigger_at,
                        message=rem.message,
                    )
                logger.info(f"Loaded {len(pending)} pending reminders from SQLite.")
        except Exception as e:
            logger.warning(f"Notice loading pending reminders: {e}")

        # Schedule automatic daily continuous learning & personalization cycle (every 6 hours)
        try:
            from edith.memory.learner import continuous_learner
            self.scheduler.add_job(
                continuous_learner.run_personalization_cycle,
                trigger="interval",
                hours=6,
                id="auto_continuous_learning",
                replace_existing=True,
            )
            logger.info("Automatic continuous learning cycle scheduled (every 6 hours).")
        except Exception as e:
            logger.debug(f"Continuous learning schedule notice: {e}")


# Global scheduler instance
edith_scheduler = EdithScheduler()
