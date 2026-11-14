"""
Shell Command Sanitizer & Injection Guard for EDITH.
Inspects terminal execution requests against security blacklists.
"""

from __future__ import annotations
import re
from typing import Tuple
from loguru import logger


class CommandSanitizer:
    """Enforces strict safety rules on terminal commands requested by AI."""

    FORBIDDEN_PATTERNS = [
        r"\bformat\b",
        r"\bdiskpart\b",
        r"\brmdir\s+/[sS]\b",
        r"\bdel\s+/[sS]\b",
        r"\breg\s+delete\b",
        r"\bshutdown\s+/[sSrR]\b",
        r"Remove-Item.*-Recurse.*[C|c]:\\",
        r"\bdd\b",
        r":\(\)\{\s*:\|:&\s*\};:",  # Fork bomb
    ]

    @classmethod
    def sanitize(cls, command: str) -> Tuple[bool, str]:
        """
        Validates command safety.
        Returns: (is_safe: bool, reason: str)
        """
        clean_cmd = command.strip()
        if not clean_cmd:
            return False, "Empty command string."

        # Check forbidden regex patterns
        for pattern in cls.FORBIDDEN_PATTERNS:
            if re.search(pattern, clean_cmd, re.IGNORECASE):
                logger.warning(f"Security Alert: Blocked dangerous command pattern '{pattern}': {clean_cmd}")
                return False, f"Command rejected: Contains dangerous or forbidden command pattern ('{pattern}')."

        return True, "Command verified"

