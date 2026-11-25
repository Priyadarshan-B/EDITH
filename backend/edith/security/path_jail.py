"""
Directory Path Jailing & Filesystem Boundary Validator for EDITH.
Ensures file operations cannot touch critical Windows OS directories or escape user project roots.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import List, Tuple
from loguru import logger

from edith.config import settings


class PathJailSecurity:
    """Enforces sandbox path restrictions for reading, writing, and deleting files."""

    FORBIDDEN_SYSTEM_PATHS = [
        Path(os.environ.get("WINDIR", "C:\\Windows")).resolve(),
        Path(os.environ.get("ProgramFiles", "C:\\Program Files")).resolve(),
        Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")).resolve(),
        Path("C:\\Windows\\System32").resolve(),
    ]

    _dynamic_allowed_roots: List[Path] = []

    @classmethod
    def add_allowed_root(cls, path_str: str) -> Path:
        """Registers an operator-approved workspace directory (outside forbidden Windows system paths)."""
        resolved = Path(os.path.expandvars(path_str)).resolve()
        for sys_path in cls.FORBIDDEN_SYSTEM_PATHS:
            if resolved == sys_path or sys_path in resolved.parents:
                raise PermissionError(f"Cannot allow protected Windows system path: {resolved}")
        if resolved not in cls._dynamic_allowed_roots:
            cls._dynamic_allowed_roots.append(resolved)
        return resolved

    @classmethod
    def get_allowed_roots(cls) -> List[Path]:
        """Resolves user profile and project roots configured in default_config.yaml."""
        allowed = []
        user_profile = Path(os.environ.get("USERPROFILE", "C:\\Users")).resolve()
        allowed.append(user_profile)

        for root_str in settings.security.allowed_roots:
            expanded = os.path.expandvars(root_str)
            p = Path(expanded).resolve()
            if p.exists() and p not in allowed:
                allowed.append(p)

        for p in cls._dynamic_allowed_roots:
            if p not in allowed:
                allowed.append(p)

        return allowed

    @classmethod
    def resolve_and_validate(cls, target_path_str: str, for_mutation: bool = False) -> Path:
        """Resolves path and raises PermissionError if it violates path jail security."""
        is_safe, reason = cls.validate_path(target_path_str, for_mutation=for_mutation)
        if not is_safe:
            raise PermissionError(reason)
        return Path(os.path.expandvars(target_path_str)).resolve()

    @classmethod
    def validate_path(cls, target_path_str: str, for_mutation: bool = False) -> Tuple[bool, str]:
        """
        Validates target path against jail rules.
        Returns: (is_safe: bool, reason: str)
        """
        try:
            target_path = Path(os.path.expandvars(target_path_str)).resolve()
        except Exception as e:
            return False, f"Invalid path syntax: {e}"

        # 1. Unconditionally block Windows system folders
        for sys_path in cls.FORBIDDEN_SYSTEM_PATHS:
            try:
                if target_path == sys_path or sys_path in target_path.parents:
                    logger.warning(f"Security Alert: Blocked access to system path: {target_path}")
                    return False, f"Access denied: Target path '{target_path}' is a protected Windows system directory."
            except Exception:
                pass

        # 2. If strict jailing is enabled, enforce that target is under an allowed root
        if settings.security.strict_jailing:
            allowed_roots = cls.get_allowed_roots()
            is_under_allowed = False
            for root in allowed_roots:
                try:
                    if target_path == root or root in target_path.parents:
                        is_under_allowed = True
                        break
                except Exception:
                    pass

            if not is_under_allowed:
                logger.warning(f"Security Alert: Target path outside allowed roots: {target_path}")
                return False, f"Access denied: Path '{target_path}' is outside approved directories."

        return True, "Path validated"

