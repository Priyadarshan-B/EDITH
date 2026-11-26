"""
Backend entry point for EDITH.
Executed by Tauri sidecar supervisor or standalone during development.
"""

import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from edith.config import settings


def main():
    host = os.environ.get("EDITH_HOST", settings.server.host)
    port = int(os.environ.get("EDITH_PORT", settings.server.port))
    # Enable auto-reload by default during development
    reload = os.environ.get("EDITH_RELOAD", "true").lower() in ("true", "1", "yes")

    import logging
    # Silence noisy 2-second WebSocket frame & SQLAlchemy debug logs in terminal
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("websockets.server").setLevel(logging.WARNING)
    logging.getLogger("websockets.protocol").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    print(f"Starting EDITH API Server at http://{host}:{port} (Auto-reload: {'ON' if reload else 'OFF'})")
    uvicorn.run(
        "edith.server:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=[str(backend_dir)],
        log_level="info",
    )


if __name__ == "__main__":
    main()

