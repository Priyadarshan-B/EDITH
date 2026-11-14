"""
Database connection and session factory for SQLite via SQLAlchemy 2.0.
"""

from __future__ import annotations
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from edith.config import settings, find_project_root

Base = declarative_base()

# Resolve database location relative to project root
db_rel_path = Path(settings.database.sqlite_path)
if not db_rel_path.is_absolute():
    db_full_path = find_project_root() / db_rel_path
else:
    db_full_path = db_rel_path

# Ensure data directory exists
db_full_path.parent.mkdir(parents=True, exist_ok=True)

SQLITE_URL = f"sqlite+aiosqlite:///{db_full_path.as_posix()}"

engine = create_async_engine(
    SQLITE_URL,
    echo=settings.debug,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Creates all database tables on application initialization."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session():
    """Dependency injector for FastAPI route handlers."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
