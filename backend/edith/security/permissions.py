"""
Security Permissions & Risk Classification for EDITH.
Defines risk tiers and human-in-the-loop authorization policies.
"""

from __future__ import annotations
from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel


class ActionRiskTier(str, Enum):
    READ_ONLY = "read_only"
    LOW_RISK_REVERSIBLE = "low_risk_reversible"
    SENSITIVE = "sensitive"
    DESTRUCTIVE_PRIVILEGED = "destructive_privileged"


class AuthorizationMode(str, Enum):
    AUTO = "auto"
    VOICE_CONFIRMED = "voice_confirmed"
    GUI_MODAL_CONFIRMED = "gui_modal_confirmed"
    DENIED = "denied"


class PendingAction(BaseModel):
    action_id: str
    tool_name: str
    risk_tier: ActionRiskTier
    parameters: Dict[str, Any]
    description: str
    requires_gui_modal: bool
    requires_voice_confirmation: bool
    confirmation_phrase: Optional[str] = None
    created_at: float
