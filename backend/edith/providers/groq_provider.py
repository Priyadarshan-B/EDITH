"""
Groq Cloud LLM Provider for EDITH.
Uses Groq's OpenAI-compatible API (ultra-fast inference).
Auto-discovers active chat models (excluding TTS/STT/guard models) and falls back cleanly.
"""

from __future__ import annotations
import os
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider


GROQ_API_BASE = "https://api.groq.com/openai/v1"

# Priority order of preferred chat LLM models on Groq
PREFERRED_MODELS = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "allam-2-7b",
]

GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b"

# Non-chat model substrings to exclude from auto-selection
_EXCLUDED_SUBSTRINGS = ("whisper", "orpheus", "prompt-guard", "safeguard", "tts", "guard")

# Global cache for validated chat models
_cached_available_models: List[str] = []


class GroqProvider(BaseLLMProvider):
    """Groq API provider — OpenAI-compatible, ultra-fast inference."""

    def __init__(
        self,
        model_name: str = GROQ_DEFAULT_MODEL,
        api_key: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(model_name, config)
        self.api_key = api_key or os.environ.get("GROQ_API_KEY", "")

    async def is_available(self) -> bool:
        return bool(self.api_key.strip())

    async def fetch_available_models(self, client: httpx.AsyncClient) -> List[str]:
        """Queries Groq /models and returns usable chat models."""
        global _cached_available_models
        if _cached_available_models:
            return _cached_available_models

        try:
            resp = await client.get(
                f"{GROQ_API_BASE}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=6.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [
                    m["id"]
                    for m in data.get("data", [])
                    if not any(bad in m.get("id", "").lower() for bad in _EXCLUDED_SUBSTRINGS)
                ]
                if models:
                    _cached_available_models = models
                    logger.info(f"Groq available chat models: {_cached_available_models}")
                    return _cached_available_models
        except Exception as e:
            logger.warning(f"Could not fetch Groq model list: {e}")

        return PREFERRED_MODELS

    def resolve_model_name(self, requested: str, available: List[str]) -> str:
        """Finds the best matching chat model from the available list."""
        if requested in available:
            return requested

        req_clean = requested.lower().replace("-", "").replace(".", "").replace(":", "")
        for m in available:
            m_clean = m.lower().replace("-", "").replace(".", "").replace(":", "")
            if req_clean in m_clean or m_clean in req_clean:
                return m

        for pref in PREFERRED_MODELS:
            if pref in available:
                return pref

        return available[0] if available else GROQ_DEFAULT_MODEL

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield (
                "Boss, Groq cloud is offline — no API key configured. "
                "Add GROQ_API_KEY to your .env file."
            )
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(30.0, connect=8.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            available = await self.fetch_available_models(client)
            active_model = self.resolve_model_name(self.model_name, available)

            candidates = [active_model]
            for m in PREFERRED_MODELS + available:
                if m not in candidates and not any(bad in m.lower() for bad in _EXCLUDED_SUBSTRINGS):
                    if not available or m in available:
                        candidates.append(m)

            last_error_text = ""
            for candidate in candidates:
                payload: Dict[str, Any] = {
                    "model": candidate,
                    "messages": messages,
                    "temperature": temperature,
                    "stream": True,
                }
                if max_tokens:
                    payload["max_tokens"] = max_tokens

                try:
                    async with client.stream(
                        "POST",
                        f"{GROQ_API_BASE}/chat/completions",
                        json=payload,
                        headers=headers,
                    ) as response:
                        if response.status_code in (400, 404, 429):
                            err_data = await response.aread()
                            last_error_text = err_data.decode("utf-8", errors="replace")
                            logger.warning(
                                f"Groq model '{candidate}' failed ({response.status_code}), trying next fallback..."
                            )
                            continue

                        if response.status_code != 200:
                            err_data = await response.aread()
                            err_text = err_data.decode("utf-8", errors="replace")
                            logger.error(f"Groq API error ({response.status_code}): {err_text}")
                            yield (
                                "Boss, Groq returned an unexpected status. "
                                "Desktop controls and local commands are still online."
                            )
                            return

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                raw = line[6:].strip()
                                if raw == "[DONE]" or not raw:
                                    continue
                                try:
                                    data = json.loads(raw)
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                                except (json.JSONDecodeError, KeyError):
                                    continue
                        return

                except httpx.TimeoutException:
                    logger.error(f"Groq API connection timed out on model {candidate}.")
                    continue
                except Exception as e:
                    logger.error(f"Groq provider error: {e}")
                    continue

            logger.error(f"All Groq model candidates failed: {last_error_text}")
            yield (
                "Boss, none of the Groq cloud models could be reached right now. "
                "Please check your GROQ_API_KEY or switch to Gemini Pro / Ollama."
            )

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> str:
        chunks = []
        async for chunk in self.generate_stream(messages, temperature, max_tokens, **kwargs):
            chunks.append(chunk)
        return "".join(chunks)
