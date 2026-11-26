"""
Neural Text-to-Speech (Edge-TTS) and Female English Voice Pack API for EDITH.
"""

from __future__ import annotations
import io
import json
import re
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from loguru import logger

from edith.config import find_project_root, settings
from edith.providers.manager import model_manager

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
DEFAULT_VOICE_ID = "en-AU-NatashaNeural"
_VOICE_SETTINGS_PATH = find_project_root() / "data" / "voice_settings.json"


def _load_voice_settings() -> dict:
    """Loads persisted voice settings from disk, falling back to Natasha (AU)."""
    state = {"active_voice": DEFAULT_VOICE_ID, "rate": 1.0}
    try:
        if _VOICE_SETTINGS_PATH.exists():
            saved = json.loads(_VOICE_SETTINGS_PATH.read_text(encoding="utf-8"))
            v_id = saved.get("active_voice")
            if isinstance(v_id, str) and v_id in _VALID_VOICE_IDS:
                state["active_voice"] = v_id
            rate = saved.get("rate")
            if isinstance(rate, (int, float)) and 0.5 <= float(rate) <= 1.5:
                state["rate"] = round(float(rate), 2)
    except Exception as e:
        logger.warning(f"Could not load saved voice settings: {e}")
    return state


def _save_voice_settings(state: dict) -> None:
    """Persists active voice pack and rate to disk."""
    try:
        _VOICE_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _VOICE_SETTINGS_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not persist voice settings: {e}")


# Active voice configuration (loaded from disk on startup)
_voice_state = _load_voice_settings()


class VoiceSettingsUpdate(BaseModel):
    active_voice: Optional[str] = None
    rate: Optional[float] = Field(default=None, ge=0.5, le=1.5)


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    voice: Optional[str] = None
    rate: Optional[float] = Field(default=None, ge=0.5, le=1.5)


class SummarizeSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=12000)


def _fallback_spoken_summary(raw: str) -> str:
    """Clean, natural fallback summary when LLM summarization is unavailable."""
    text = re.sub(r"```[\s\S]*?```", " ", raw or "")
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[`*_#|>{}\[\]]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 2]
    summary = " ".join(sentences[:2]) if sentences else text[:220]
    if len(summary) > 260:
        summary = summary[:257].rsplit(" ", 1)[0].rstrip(",;:") + "."
    return summary


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
    """Updates and persists the active female English voice pack and speaking rate."""
    if payload.active_voice is not None:
        if payload.active_voice not in _VALID_VOICE_IDS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported voice pack '{payload.active_voice}'.",
            )
        _voice_state["active_voice"] = payload.active_voice

    if payload.rate is not None:
        _voice_state["rate"] = round(payload.rate, 2)

    _save_voice_settings(_voice_state)

    return {
        "active_voice": _voice_state["active_voice"],
        "rate": _voice_state["rate"],
    }


@router.post("/summarize")
async def summarize_for_speech(payload: SummarizeSpeechRequest):
    """Summarizes an assistant response via the LLM into clear, friendly human speech."""
    u_name = settings.user.name or "Priyan"
    u_title = settings.user.title or "Boss"
    prompt_messages = [
        {
            "role": "system",
            "content": (
                "You are EDITH speaking out loud to your user.\n"
                f"Rewrite the given assistant response into 1 or 2 short, warm, friendly human sentences that are super easy to understand when heard.\n"
                f"Naturally address the user as '{u_title}', 'Sir', or '{u_name}' when fitting.\n"
                "Rules:\n"
                "- Do NOT read markdown, code, file paths, URLs, symbols, or bullet lists verbatim.\n"
                "- Summarize the real takeaway plainly like a helpful human friend.\n"
                "- Output ONLY the spoken sentences (no quotes, no labels)."
            ),
        },
        {
            "role": "user",
            "content": f"Summarize this response for spoken voice output:\n\n{payload.text[:6000]}",
        },
    ]
    try:
        spoken = await model_manager.generate_with_fallback(
            prompt_messages,
            temperature=0.4,
            max_tokens=160,
        )
        cleaned = _fallback_spoken_summary(spoken)
        if cleaned:
            return {"spoken_text": cleaned, "summarized": True}
    except Exception as e:
        logger.warning(f"LLM voice summarization fell back to local cleaner: {e}")

    return {"spoken_text": _fallback_spoken_summary(payload.text), "summarized": False}


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
