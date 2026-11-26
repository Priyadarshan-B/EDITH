"""
SQLite Database Log Sink for EDITH.
Persists application logs (errors, warnings, API calls, LLM responses, system events)
into the `system_logs` table in data/edith.db.
"""

from __future__ import annotations
import sqlite3
import uuid
from datetime import datetime

from edith.memory.database import db_full_path


def _infer_category(source: str, message: str, level: str) -> str:
    low_src = source.lower()
    low_msg = message.lower()
    if level in ("ERROR", "CRITICAL"):
        return "error"
    if "llm" in low_msg or "providers" in low_src or "chat" in low_src:
        return "llm"
    if low_msg.startswith("api ") or "api." in low_src:
        return "api"
    if "mcp" in low_src or "mcp" in low_msg:
        return "mcp"
    if "voice" in low_src:
        return "voice"
    return "system"


def db_log_sink(message) -> None:
    """Loguru sink that writes structured log records into `system_logs`."""
    try:
        record = message.record
        level = record["level"].name
        source = f"{record['name']}:{record['line']}"
        text = str(record["message"])
        category = _infer_category(source, text, level)
        details = None
        if record["exception"]:
            details = str(record["exception"])

        with sqlite3.connect(str(db_full_path), timeout=3.0) as conn:
            conn.execute(
                """
                INSERT INTO system_logs (id, level, category, source, message, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    level,
                    category,
                    source[:120],
                    text,
                    details,
                    datetime.utcnow().isoformat(sep=" "),
                ),
            )
    except Exception:
        # Never crash application logging if DB is busy or not yet initialized
        pass
