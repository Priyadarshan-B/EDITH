"""
Neural Text-to-Speech (Edge-TTS) and Female English Voice Pack API for EDITH.
"""

from __future__ import annotations
import io
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from loguru import logger

router = APIRouter(prefix="/voice", tags=["Voice"])


class VoicePackInfo(BaseModel):
    id: str
    name: str
    locale: str
    accent: str
    description: str


FEMALE_ENGLISH_VOICE_PACKS: List[VoicePackInfo] = [
    VoicePackInfo(
        id="en-GB-SoniaNeural",
        name="Sonia (UK)",
        locale="en-GB",
        accent="British English",
        description="Warm, composed British female assistant voice",
    ),
    VoicePackInfo(
        id="en-GB-LibbyNeural",
        name="Libby (UK)",
        locale="en-GB",
        accent="British English",
        description="Bright, friendly British female voice",
    ),
    VoicePackInfo(
        id="en-US-JennyNeural",
        name="Jenny (US)",
        locale="en-US",
        accent="American English",
        description="Natural, conversational American female voice",
    ),
    VoicePackInfo(
        id="en-US-AriaNeural",
        name="Aria (US)",
        locale="en-US",
        accent="American English",
        description="Expressive, crisp American female voice",
    ),
    VoicePackInfo(
        id="en-AU-NatashaNeural",
        name="Natasha (AU)",
        locale="en-AU",
        accent="Australian English",
        description="Smooth, articulate Australian female voice",
    ),
    VoicePackInfo(
        id="en-IN-NeerjaNeural",
        name="Neerja (IN)",
        locale="en-IN",
        accent="Indian English",
        description="Clear, expressive Indian English female voice",
    ),
]

_VALID_VOICE_IDS = {v.id for v in FEMALE_ENGLISH_VOICE_PACKS}

# In-memory active voice configuration
_voice_state = {
    "active_voice": "en-GB-SoniaNeural",
    "rate": 1.0,
}


class VoiceSettingsUpdate(BaseModel):
    active_voice: Optional[str] = None
    rate: Optional[float] = Field(default=None, ge=0.5, le=1.5)


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    voice: Optional[str] = None
    rate: Optional[float] = Field(default=None, ge=0.5, le=1.5)


def _format_edge_rate(rate: float) -> str:
    """Converts a 0.5-1.5 multiplier into Edge-TTS percentage string (e.g. +0%, -20%)."""
    pct = int(round((rate - 1.0) * 100))
    return f"{pct:+d}%"


@router.get("/packs")
async def get_voice_packs():
    """Returns curated female English voice packs and current selection."""
    return {
        "active_voice": _voice_state["active_voice"],
        "rate": _voice_state["rate"],
        "packs": [p.model_dump() for p in FEMALE_ENGLISH_VOICE_PACKS],
    }


@router.post("/settings")
async def update_voice_settings(payload: VoiceSettingsUpdate):
    """Updates the active female English voice pack and speaking rate."""
    if payload.active_voice is not None:
        if payload.active_voice not in _VALID_VOICE_IDS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported voice pack '{payload.active_voice}'.",
            )
        _voice_state["active_voice"] = payload.active_voice

    if payload.rate is not None:
        _voice_state["rate"] = round(payload.rate, 2)

    return {
        "active_voice": _voice_state["active_voice"],
        "rate": _voice_state["rate"],
    }


@router.post("/synthesize")
async def synthesize_speech(payload: SynthesizeRequest):
    """Synthesizes speech using Edge-TTS neural voices and returns MP3 audio bytes."""
    voice = payload.voice or _voice_state["active_voice"]
    if voice not in _VALID_VOICE_IDS:
        voice = _voice_state["active_voice"]
    rate = payload.rate if payload.rate is not None else _voice_state["rate"]
    rate_str = _format_edge_rate(rate)

    try:
        import edge_tts

        communicate = edge_tts.Communicate(payload.text, voice, rate=rate_str)
        audio_buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        audio_bytes = audio_buffer.getvalue()
        if not audio_bytes:
            raise RuntimeError("Edge-TTS returned empty audio stream.")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as e:
        logger.warning(f"Edge-TTS synthesis failed: {e}")
        raise HTTPException(status_code=503, detail=f"TTS synthesis unavailable: {e}")
