"""
Database Introspection & Table Explorer Endpoints for EDITH.
Allows frontend to inspect SQLite schema, list tables, browse data rows, and run read queries.
"""

from __future__ import annotations
import os
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/database", tags=["Database Explorer"])

DB_PATH = Path("data/edith.db").resolve()


def get_sqlite_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Database file not found at {DB_PATH}")
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con


@router.get("/info")
async def get_database_info() -> Dict[str, Any]:
    """Returns database file path, file size on disk, and table summaries."""
    if not DB_PATH.exists():
        return {
            "path": str(DB_PATH),
            "exists": False,
            "size_bytes": 0,
            "tables": [],
        }

    size_bytes = DB_PATH.stat().st_size
    con = get_sqlite_conn()
    cur = con.cursor()

    tables_info = []
    # Query all user tables in SQLite
    table_rows = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    ).fetchall()

    for row in table_rows:
        tname = row["name"]
        cnt = cur.execute(f"SELECT COUNT(1) FROM {tname}").fetchone()[0]
        # Get column definitions
        col_rows = cur.execute(f"PRAGMA table_info({tname});").fetchall()
        columns = [
            {"cid": c["cid"], "name": c["name"], "type": c["type"], "pk": bool(c["pk"])}
            for c in col_rows
        ]
        tables_info.append({
            "name": tname,
            "row_count": cnt,
            "columns": columns,
        })

    con.close()

    return {
        "path": str(DB_PATH),
        "exists": True,
        "size_bytes": size_bytes,
        "size_kb": round(size_bytes / 1024, 2),
        "tables": tables_info,
    }


@router.get("/table/{table_name}")
async def get_table_data(
    table_name: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """Returns paginated data rows and column schema for a given table."""
    con = get_sqlite_conn()
    cur = con.cursor()

    # Verify table exists to prevent SQL injection
    valid_tables = [
        r["name"]
        for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        ).fetchall()
    ]

    if table_name not in valid_tables:
        con.close()
        raise HTTPException(status_code=400, detail=f"Invalid table: '{table_name}'.")

    # Column info
    col_rows = cur.execute(f"PRAGMA table_info({table_name});").fetchall()
    columns = [
        {"cid": c["cid"], "name": c["name"], "type": c["type"], "pk": bool(c["pk"])}
        for c in col_rows
    ]
    col_names = [c["name"] for c in col_rows]

    # Total row count
    total_count = cur.execute(f"SELECT COUNT(1) FROM {table_name}").fetchone()[0]

    # Fetch rows with optional text search across columns
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        # Match text against text/varchar columns
        where_clauses = [f"{col} LIKE ?" for col in col_names]
        query = f"SELECT * FROM {table_name} WHERE {' OR '.join(where_clauses)} LIMIT ? OFFSET ?"
        params = [search_term] * len(where_clauses) + [limit, offset]
        rows = cur.execute(query, params).fetchall()
    else:
        # Default order by created_at desc or pk desc if available
        order_col = "created_at" if "created_at" in col_names else col_names[0]
        query = f"SELECT * FROM {table_name} ORDER BY {order_col} DESC LIMIT ? OFFSET ?"
        rows = cur.execute(query, (limit, offset)).fetchall()

    row_dicts = [dict(r) for r in rows]
    con.close()

    return {
        "table": table_name,
        "total_rows": total_count,
        "limit": limit,
        "offset": offset,
        "columns": columns,
        "rows": row_dicts,
    }
