"""
Built-in EDITH MCP Server (Python MCP 2.x stdio).
Provides ready-to-use Developer & Personal User tools out-of-the-box:
- search_code_in_workspace
- git_diff_summary
- fetch_webpage_text
- save_quick_note
- list_quick_notes
"""

from __future__ import annotations
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List
import httpx
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("edith-core-mcp")

NOTES_FILE = Path("data/notes.json")
IGNORE_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "target"}


@mcp.tool()
def search_code_in_workspace(directory: str, pattern: str, max_results: int = 20) -> str:
    """Searches source files in a project folder for a text or regex pattern (Developer)."""
    root = Path(directory).expanduser().resolve()
    if not root.exists():
        return f"Directory not found: {directory}"
    regex = re.compile(pattern, re.IGNORECASE)
    matches: List[str] = []
    for p in root.rglob("*"):
        if any(part in IGNORE_DIRS for part in p.parts) or not p.is_file():
            continue
        if p.stat().st_size > 512_000:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
            for idx, line in enumerate(text.splitlines(), 1):
                if regex.search(line):
                    rel = p.relative_to(root)
                    matches.append(f"{rel}:{idx}: {line.strip()[:140]}")
                    if len(matches) >= max_results:
                        return "\n".join(matches)
        except Exception:
            continue
    return "\n".join(matches) if matches else f"No matches for '{pattern}' in {root}."


@mcp.tool()
def git_diff_summary(repo_path: str = ".") -> str:
    """Returns modified files and short diff stat for a Git repository (Developer)."""
    root = Path(repo_path).expanduser().resolve()
    if not root.exists():
        return f"Repository not found: {repo_path}"
    proc = subprocess.run(
        ["git", "diff", "--stat"],
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=6,
    )
    status_proc = subprocess.run(
        ["git", "status", "-s"],
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=6,
    )
    out = (status_proc.stdout.strip() + "\n" + proc.stdout.strip()).strip()
    return out or "Working tree clean."


@mcp.tool()
def fetch_webpage_text(url: str, max_chars: int = 2500) -> str:
    """Fetches a webpage or documentation URL and extracts clean readable text."""
    try:
        resp = httpx.get(url, timeout=8.0, follow_redirects=True)
        html = resp.text
        # Strip scripts/styles and HTML tags
        cleaned = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", html, flags=re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = " ".join(cleaned.split())
        return cleaned[:max_chars] if cleaned else f"Empty response from {url}"
    except Exception as e:
        return f"Failed to fetch {url}: {e}"


@mcp.tool()
def save_quick_note(title: str, content: str) -> str:
    """Saves a personal note or developer snippet into EDITH's local notes vault."""
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    notes = []
    if NOTES_FILE.exists():
        try:
            notes = json.loads(NOTES_FILE.read_text(encoding="utf-8"))
        except Exception:
            notes = []
    notes.insert(
        0,
        {
            "title": title.strip(),
            "content": content.strip(),
            "created_at": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        },
    )
    NOTES_FILE.write_text(json.dumps(notes[:100], indent=2), encoding="utf-8")
    return f"Saved note '{title}'."


@mcp.tool()
def list_quick_notes(limit: int = 10) -> str:
    """Lists your recent saved personal notes and developer snippets."""
    if not NOTES_FILE.exists():
        return "No quick notes saved yet."
    try:
        notes = json.loads(NOTES_FILE.read_text(encoding="utf-8"))[:limit]
        if not notes:
            return "No quick notes saved yet."
        return "\n".join(f"- [{n['created_at']}] {n['title']}: {n['content']}" for n in notes)
    except Exception as e:
        return f"Could not read notes: {e}"


if __name__ == "__main__":
    mcp.run()
