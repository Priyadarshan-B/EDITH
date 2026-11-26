"""
FastAPI Server Application Factory for EDITH.
Configures CORS, authentication middleware, database initialization, and routing.
"""

from __future__ import annotations
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from edith.config import settings
from edith.memory.database import init_db
from edith.api.v1.health import router as health_router
from edith.api.v1.system import router as system_router
from edith.api.v1.chat import router as chat_router
from edith.api.v1.actions import router as actions_router
from edith.api.v1.memory import router as memory_router
from edith.api.v1.productivity import router as productivity_router
from edith.api.v1.training import router as training_router
from edith.api.v1.database import router as database_router
from edith.api.v1.voice import router as voice_router
from edith.api.v1.vision import router as vision_router
from edith.api.v1.antigravity import router as antigravity_router
from edith.api.v1.workspaces import router as workspaces_router
from edith.api.v1.mcp import router as mcp_router
from edith.api.websocket import router as ws_router
from edith.productivity.scheduler import edith_scheduler
from edith.vision.virtual_mouse import virtual_mouse
from edith.core.boot_log import BOOT_LOG_PATH, set_backend_ready
from edith.core.db_logger import db_log_sink
import logging
import time

# Silence noisy 2-second WebSocket frame & SQLAlchemy debug logs in terminal
for _noisy in ("websockets", "websockets.server", "websockets.protocol", "sqlalchemy.engine"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# Configure Loguru logger (clean stdout + boot log + SQLite system_logs sink)
BOOT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
logger.remove()
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
)
logger.add(
    str(BOOT_LOG_PATH),
    format="{time:HH:mm:ss} | {level:<7} | {name} - {message}",
    level="INFO",
    enqueue=True,
)
logger.add(
    db_log_sink,
    level="INFO",
    enqueue=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    logger.info(f"Initializing {settings.name} v{settings.version} backend...")
    # Initialize SQLite tables
    try:
        await init_db()
        logger.info("SQLite database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    # Start APScheduler & load pending reminders
    try:
        edith_scheduler.start()
        await edith_scheduler.load_pending_from_db()
    except Exception as e:
        logger.warning(f"Scheduler initialization notice: {e}")

    set_backend_ready(True)
    logger.info("EDITH AI Core Backend startup complete.")

    # Auto-select best installed local Ollama model for system hardware & initialize MCP servers
    import asyncio
    from edith.providers.manager import model_manager
    from edith.mcp.manager import mcp_manager
    asyncio.create_task(model_manager.auto_select_local_model())
    asyncio.create_task(mcp_manager.initialize_enabled_servers())

    yield

    logger.info("Shutting down EDITH backend services...")
    virtual_mouse.stop()
    edith_scheduler.shutdown()


def create_app() -> FastAPI:
    """Builds and configures the FastAPI application instance."""
    app = FastAPI(
        title=settings.name,
        version=settings.version,
        description="EDITH: Personal AI Desktop Assistant Core Orchestration API",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.server.cors_origins + ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security Token Middleware (Optional in dev, enforced when EDITH_AUTH_TOKEN is set)
    @app.middleware("http")
    async def verify_auth_token(request: Request, call_next):
        expected_token = os.environ.get("EDITH_AUTH_TOKEN")
        # Exempt health probe and docs from token requirement for discovery
        if expected_token and not request.url.path.startswith(("/health", "/docs", "/openapi.json")):
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Missing or malformed Authorization header."},
                )
            token = auth_header.split(" ", 1)[1]
            if token != expected_token:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Invalid authentication token."},
                )

        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        path = request.url.path
        if path.startswith("/api/") and path != "/api/v1/system/telemetry":
            logger.info(f"API {request.method} {path} -> {response.status_code} ({elapsed_ms}ms)")
        return response

    # Mount API routers
    app.include_router(health_router)
    app.include_router(system_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(actions_router, prefix="/api/v1")
    app.include_router(memory_router, prefix="/api/v1")
    app.include_router(productivity_router, prefix="/api/v1")
    app.include_router(training_router, prefix="/api/v1")
    app.include_router(database_router, prefix="/api/v1")
    app.include_router(voice_router, prefix="/api/v1")
    app.include_router(vision_router, prefix="/api/v1")
    app.include_router(antigravity_router, prefix="/api/v1")
    app.include_router(workspaces_router, prefix="/api/v1")
    app.include_router(mcp_router, prefix="/api/v1")
    app.include_router(ws_router)

    # Serve built React Web App (frontend/dist) if available
    dist_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist_dir.exists() and dist_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="webapp")
        logger.info(f"Serving standalone Web App from {dist_dir}")

    return app


app = create_app()

