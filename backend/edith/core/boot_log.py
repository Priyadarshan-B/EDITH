"""
Real-time Startup Boot Log Tracker for EDITH.
Collects real launcher, backend, and voice worker startup lines for the BootLoader UI.
"""

from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any

BOOT_LOG_PATH = Path("data/boot.log")
_boot_state = {
    "backend_ready": False,
    "voice_ready": False,
}


def set_backend_ready(ready: bool = True):
    _boot_state["backend_ready"] = ready


def set_voice_ready(ready: bool = True):
    _boot_state["voice_ready"] = ready


def append_boot_log(line: str):
    try:
        BOOT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(BOOT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line.rstrip() + "\n")
    except Exception:
        pass


def read_boot_logs(limit: int = 40) -> Dict[str, Any]:
    lines: List[str] = []
    if BOOT_LOG_PATH.exists():
        try:
            with open(BOOT_LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
                all_lines = [ln.rstrip() for ln in f.readlines() if ln.strip()]
                lines = all_lines[-limit:]
        except Exception:
            pass
    return {
        "backend_ready": _boot_state["backend_ready"],
        "voice_ready": _boot_state["voice_ready"],
        "logs": lines,
    }
