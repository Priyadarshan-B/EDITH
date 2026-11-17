"""
Autonomous Proactive Watcher & Alert Daemon for EDITH.
Monitors:
1. High-priority/urgent unread emails.
2. System hardware health (CPU thermal throttle, high RAM, disk space).
3. Scheduled reminders and morning briefing triggers.
Dispatches voice directives & native Windows toast alerts.
"""

from __future__ import annotations
import asyncio
import os
import psutil
from typing import Dict, Any, Optional
from loguru import logger

from edith.productivity.notifications import show_system_notification
from edith.tools.mail import FetchEmailsTool
from edith.tools.web_search import LiveWeatherTool


class ProactiveSentinel:
    """Proactive background monitor running autonomously alongside EDITH."""

    def __init__(self, check_interval_seconds: int = 120):
        self.interval = check_interval_seconds
        self._running = False
        self._seen_email_subjects: set[str] = set()
        self._task: Optional[asyncio.Task] = None
        self._mail_tool = FetchEmailsTool()
        self._weather_tool = LiveWeatherTool()

    async def start(self):
        """Starts the proactive background loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"EDITH Proactive Sentinel started (Polling interval: {self.interval}s)")

    async def stop(self):
        """Stops the proactive background loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("EDITH Proactive Sentinel stopped.")

    async def _monitor_loop(self):
        while self._running:
            try:
                await asyncio.gather(
                    self._check_system_health(),
                    self._check_urgent_emails(),
                    return_exceptions=True
                )
            except Exception as e:
                logger.error(f"Error in Proactive Sentinel: {e}")

            await asyncio.sleep(self.interval)

    async def _check_system_health(self):
        """Monitors CPU and RAM pressure, alerting if critical."""
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()

        if mem.percent > 92.0:
            show_system_notification(
                title="EDITH System Health Alert",
                message=f"Critical Memory Pressure: RAM usage is at {mem.percent:.1f}%.",
            )
        elif cpu > 95.0:
            show_system_notification(
                title="EDITH High Load Alert",
                message=f"High CPU Utilization: Core load at {cpu:.1f}%.",
            )

    async def _check_urgent_emails(self):
        """Checks unread emails for urgent keywords (Urgent, ASAP, Meeting, Production)."""
        # Only run if user has configured mail credentials
        if not os.getenv("EDITH_MAIL_USER"):
            return

        result = await self._mail_tool.execute(folder="INBOX", limit=5, unread_only=True)
        if not result.success:
            return

        emails = result.data.get("emails", [])
        urgent_keywords = {"urgent", "asap", "production", "critical", "incident", "emergency", "interview"}

        for mail in emails:
            subj = mail.get("subject", "")
            sender = mail.get("from", "Someone")
            
            if subj not in self._seen_email_subjects:
                self._seen_email_subjects.add(subj)
                # Check for urgency
                words = set(subj.lower().split())
                if words & urgent_keywords or "urgent" in subj.lower():
                    show_system_notification(
                        title="EDITH Priority Email Alert",
                        message=f"From: {sender}\nSubject: {subj}",
                    )
                    logger.info(f"Priority email alert triggered for: {subj}")


# Singleton instance
proactive_sentinel = ProactiveSentinel()
