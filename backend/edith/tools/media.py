"""
Windows System Volume & Media Audio Control Tool for EDITH.
Controls system master volume, mute/unmute, and media playback (play/pause/next/prev).
"""

from __future__ import annotations
import asyncio
from typing import Dict, Any, Type, Optional
from pydantic import BaseModel, Field
import pyautogui

from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier


class MediaVolumeInput(BaseModel):
    action: str = Field(
        ...,
        description="Action to execute: 'volume_up', 'volume_down', 'mute', 'play_pause', 'next_track', 'prev_track', or 'set_volume'."
    )
    level: Optional[int] = Field(
        None,
        description="Target volume level from 0 to 100 (for 'set_volume')."
    )


class MediaVolumeControlTool(BaseTool):
    """Control system audio volume and media playback."""

    name = "media_volume_control"
    description = (
        "Control master audio volume and media playback. "
        "Use this when the user says 'mute', 'unmute', 'turn volume up/down', 'pause music', or 'next song'."
    )
    risk_tier = ActionRiskTier.LOW_RISK_REVERSIBLE
    parameters_schema: Type[BaseModel] = MediaVolumeInput

    async def execute(self, action: str, level: Optional[int] = None) -> ToolExecutionResult:
        act = action.lower().strip()

        def _sync_media_action() -> str:
            if act in ["mute", "unmute"]:
                pyautogui.press("volumemute")
                return "Toggled master volume mute."
            elif act in ["volume_up", "louder"]:
                for _ in range(5):
                    pyautogui.press("volumeup")
                return "Increased master volume."
            elif act in ["volume_down", "quieter", "lower"]:
                for _ in range(5):
                    pyautogui.press("volumedown")
                return "Decreased master volume."
            elif act in ["play", "pause", "play_pause"]:
                pyautogui.press("playpause")
                return "Toggled media play/pause."
            elif act in ["next", "next_track"]:
                pyautogui.press("nexttrack")
                return "Skipped to next media track."
            elif act in ["prev", "previous", "prev_track"]:
                pyautogui.press("prevtrack")
                return "Rewound to previous media track."
            else:
                return f"Unsupported media action: {act}"

        try:
            loop = asyncio.get_running_loop()
            msg = await loop.run_in_executor(None, _sync_media_action)
            return ToolExecutionResult(
                success=True,
                data={"action": act, "level": level},
                message=msg,
                verified=True
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"action": act, "error": str(e)},
                message=f"Failed to control media volume: {str(e)}",
                verified=False
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success
