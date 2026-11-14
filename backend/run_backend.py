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
    reload = settings.debug and os.environ.get("EDITH_ENV") != "production"

    print(f"Starting EDITH API Server at http://{host}:{port}")
    uvicorn.run(
        "edith.server:app",
        host=host,
        port=port,
        reload=reload,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
