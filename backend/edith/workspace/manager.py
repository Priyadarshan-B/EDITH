"""
Workspace Manager for EDITH.
Manages user-selected project workspaces, native folder browsing,
project scaffolding (never silently inside EDITH's own folder), and IDE launching.
"""

from __future__ import annotations
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from loguru import logger

from edith.security.path_jail import PathJailSecurity


class WorkspaceManager:
    """Tracks and manages project workspaces chosen by the user."""

    def __init__(self):
        self._edith_root: Path = Path(__file__).resolve().parents[3]
        self._active_workspace: Optional[Path] = None

    @property
    def edith_root(self) -> Path:
        return self._edith_root

    @property
    def active_workspace(self) -> Optional[Path]:
        return self._active_workspace

    def get_projects_root(self) -> Path:
        """Returns the primary projects directory (e.g. c:\\Projects or ~/Projects)."""
        candidates = [Path("c:\\Projects"), Path.home() / "Projects"]
        for c in candidates:
            if c.exists() and c.is_dir():
                return c.resolve()
        fallback = (Path.home() / "Projects").resolve()
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback

    def resolve_user_path(self, raw_path: str) -> Path:
        """Resolves a user-supplied folder path or shortcut (e.g. Desktop\\my-app) safely."""
        cleaned = raw_path.strip().strip('"').strip("'")
        lower = cleaned.lower()
        if lower.startswith(("desktop\\", "desktop/")):
            candidate = Path.home() / "Desktop" / cleaned.split(cleaned[7], 1)[1]
        elif lower.startswith(("documents\\", "documents/")):
            candidate = Path.home() / "Documents" / cleaned.split(cleaned[9], 1)[1]
        elif ":" not in cleaned and not cleaned.startswith(("\\\\", "/")):
            candidate = self.get_projects_root() / cleaned
        else:
            candidate = Path(os.path.expandvars(cleaned))

        resolved = candidate.resolve()
        # Register operator-supplied path (still enforces forbidden Windows OS directory blocks)
        PathJailSecurity.add_allowed_root(str(resolved))
        return PathJailSecurity.resolve_and_validate(str(resolved))

    def set_active_workspace(self, path: str, create_if_missing: bool = False) -> Dict[str, Any]:
        resolved = self.resolve_user_path(path)
        if create_if_missing:
            resolved.mkdir(parents=True, exist_ok=True)
        if not resolved.exists() or not resolved.is_dir():
            raise ValueError(f"Workspace directory does not exist: {resolved}")
        self._active_workspace = resolved
        logger.info(f"Active workspace switched to: {self._active_workspace}")
        return self.get_workspace_info(self._active_workspace)

    def list_workspaces(self) -> List[Dict[str, Any]]:
        """Lists project directories under the primary projects root."""
        root = self.get_projects_root()
        workspaces: List[Dict[str, Any]] = []
        try:
            for entry in sorted(root.iterdir(), key=lambda p: p.name.lower()):
                if entry.is_dir() and not entry.name.startswith("."):
                    workspaces.append(self.get_workspace_info(entry))
        except Exception as e:
            logger.warning(f"Failed to list workspaces under {root}: {e}")

        if self._active_workspace and self._active_workspace.exists():
            active_str = str(self._active_workspace)
            if not any(w["path"] == active_str for w in workspaces):
                workspaces.insert(0, self.get_workspace_info(self._active_workspace))
        return workspaces

    def create_workspace(
        self,
        name: str,
        template: str = "empty",
        parent_dir: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a new project folder under parent_dir (or projects_root) and sets it active."""
        # If user passed a full path in `name`, use it directly
        if ":" in name or "\\" in name or "/" in name:
            target = self.resolve_user_path(name)
            safe_name = target.name
        else:
            safe_name = "".join(c for c in name.strip() if c.isalnum() or c in ("-", "_"))
            if not safe_name:
                raise ValueError("Invalid workspace name.")
            base = self.resolve_user_path(parent_dir) if parent_dir else self.get_projects_root()
            target = (base / safe_name).resolve()
            PathJailSecurity.add_allowed_root(str(target))

        if target == self._edith_root:
            raise ValueError("Refusing to overwrite EDITH's own directory. Pick a separate project folder.")

        target.mkdir(parents=True, exist_ok=True)

        readme = target / "README.md"
        if not readme.exists():
            readme.write_text(f"# {safe_name}\n\nCreated by EDITH Workspace Manager.\n", encoding="utf-8")

        if template == "python":
            (target / "main.py").write_text(
                'def main():\n    print("Hello from ' + safe_name + '")\n\nif __name__ == "__main__":\n    main()\n',
                encoding="utf-8",
            )
            (target / "requirements.txt").write_text("", encoding="utf-8")
        elif template == "web":
            (target / "index.html").write_text(
                f"<!DOCTYPE html>\n<html><head><title>{safe_name}</title></head><body><h1>{safe_name}</h1></body></html>\n",
                encoding="utf-8",
            )

        self._active_workspace = target
        logger.info(f"Created and activated workspace: {target} (template={template})")
        return self.get_workspace_info(target)

    def browse_folder_dialog(self) -> Optional[str]:
        """Opens a native Windows folder browser dialog and returns the selected path."""
        ps_script = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$d = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$d.Description = 'Select Project Save Folder for EDITH'; "
            "$d.ShowNewFolderButton = $true; "
            "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }"
        )
        proc = subprocess.run(
            ["powershell.exe", "-NoProfile", "-STA", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=120,
        )
        selected = proc.stdout.strip()
        if selected:
            self.set_active_workspace(selected, create_if_missing=True)
            return selected
        return None

    def open_in_editor(self, path: Optional[str] = None, editor: str = "antigravity") -> Dict[str, Any]:
        """Opens the workspace in Antigravity IDE (`agy`) or VS Code (`code`)."""
        target = self.resolve_user_path(path) if path else (self._active_workspace or self.get_projects_root())
        if not target.exists():
            raise ValueError(f"Workspace path does not exist: {target}")

        cmd_candidates = ["agy", "antigravity"] if editor == "antigravity" else ["code"]
        for cmd in cmd_candidates:
            try:
                subprocess.Popen(
                    [cmd, str(target)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    shell=True,
                )
                return {"opened": True, "editor": cmd, "path": str(target)}
            except Exception:
                continue

        os.startfile(str(target))
        return {"opened": True, "editor": "explorer", "path": str(target)}

    def get_workspace_info(self, path: Optional[Path]) -> Optional[Dict[str, Any]]:
        if path is None:
            return None
        is_git = (path / ".git").exists()
        return {
            "name": path.name,
            "path": str(path),
            "is_active": self._active_workspace is not None and str(path) == str(self._active_workspace),
            "is_git": is_git,
            "is_edith_root": path.resolve() == self._edith_root,
        }


workspace_manager = WorkspaceManager()
