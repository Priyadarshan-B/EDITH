# Silence Noisy Debug Logs and Store Application Logs in `system_logs` Table

## When
November 26, 2026 — After seeing noisy 2-second WebSocket `TELEMETRY` frames, SQLAlchemy SQL dumps, and `DEBUG` lines cluttering the backend terminal.

## Why
1. The terminal was flooded every 2 seconds with WebSocket `DEBUG: > TEXT` frames and raw SQL `INSERT`/`COMMIT` logs, making it hard to spot real errors, warnings, API calls, and LLM responses.
2. All important logs needed to be saved into a dedicated SQLite database table so they can be inspected anytime.

## How it happened
- `backend/run_backend.py` ran Uvicorn with `log_level="debug"`, which enabled `websockets` protocol frame logging.
- `backend/edith/memory/database.py` had `echo=settings.debug` (`true`), printing every SQL query to stdout.
- `backend/edith/server.py` set Loguru's stdout level to `DEBUG` and had no database log sink.

## Solution
- **New `system_logs` Table (`backend/edith/memory/models.py`, `backend/edith/core/db_logger.py`)**:
  - Added the `SystemLog` SQLite model (`system_logs` table with `id`, `level`, `category`, `source`, `message`, `details`, `created_at`).
  - Created `db_log_sink` to save `INFO`, `WARNING`, `ERROR`, and `CRITICAL` logs (API calls, LLM responses, MCP, voice, and errors) into `data/edith.db`.
- **Clean Terminal Output (`backend/run_backend.py`, `backend/edith/memory/database.py`, `backend/edith/server.py`, `backend/edith/api/v1/chat.py`)**:
  - Set `echo=False` on SQLAlchemy engine and `log_level="info"` on Uvicorn, and raised `websockets` / `sqlalchemy.engine` loggers to `WARNING`.
  - Set Loguru stdout to `INFO`, added concise API call logging in HTTP middleware (skipping 2s telemetry polling), and logged LLM response summaries in `chat.py`.
- **Tests (`backend/tests/test_server_and_system.py`)**:
  - Added `test_system_logs_table_in_db` to verify `system_logs` exists in `data/edith.db`.
