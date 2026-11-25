"""
Google Gemini Cloud Provider for EDITH.
Supports Gemini Pro (gemini-2.5-pro, gemini-pro-latest, gemini-3.1-pro-preview)
and Gemini Flash (gemini-2.5-flash, gemini-flash-latest) with native systemInstruction
and automatic candidate fallback.
"""

from __future__ import annotations
import os
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider


GEMINI_PREFERRED_MODELS = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-pro-latest",
    "gemini-flash-latest",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
]

_LEGACY_MODEL_MAP = {
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-1.2-flash": "gemini-2.5-flash",
    "gemini-pro": "gemini-2.5-pro",
}


class GeminiCloudProvider(BaseLLMProvider):
    """Google Gemini API provider with full Gemini Pro & Flash support."""

    def __init__(
        self,
        model_name: str = "gemini-2.5-pro",
        api_key: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(model_name, config)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")

    async def is_available(self) -> bool:
        return bool(self.api_key.strip())

    def _resolve_candidates(self) -> List[str]:
        requested = _LEGACY_MODEL_MAP.get(self.model_name, self.model_name)
        candidates = [requested]
        for m in GEMINI_PREFERRED_MODELS:
            if m not in candidates:
                candidates.append(m)
        return candidates

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield (
                "Boss, Gemini cloud is offline — no GEMINI_API_KEY configured in your .env file."
            )
            return

        # Separate system instructions from conversation turns
        system_parts = [
            {"text": m["content"]}
            for m in messages
            if m.get("role") == "system" and m.get("content")
        ]
        contents = []
        for msg in messages:
            if msg.get("role") == "system":
                continue
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

        if not contents:
            contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": system_parts}
        if max_tokens:
            payload["generationConfig"]["maxOutputTokens"] = max_tokens

        timeout = httpx.Timeout(45.0, connect=10.0)
        last_error = ""

        async with httpx.AsyncClient(timeout=timeout) as client:
            for model_id in self._resolve_candidates():
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model_id}:streamGenerateContent?key={self.api_key}&alt=sse"
                )
                try:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code in (400, 404, 429, 503):
                            err_data = await response.aread()
                            last_error = err_data.decode("utf-8", errors="replace")
                            logger.warning(
                                f"Gemini model '{model_id}' returned {response.status_code}, trying fallback..."
                            )
                            continue

                        if response.status_code != 200:
                            err_data = await response.aread()
                            err_text = err_data.decode("utf-8", errors="replace")
                            logger.error(f"Gemini API error ({response.status_code}): {err_text}")
                            continue

                        yielded_any = False
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                raw_json = line[6:].strip()
                                if not raw_json:
                                    continue
                                try:
                                    data = json.loads(raw_json)
                                    candidates = data.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        for part in parts:
                                            text = part.get("text", "")
                                            if text:
                                                yielded_any = True
                                                yield text
                                except json.JSONDecodeError:
                                    continue
                        if yielded_any:
                            return

                except httpx.TimeoutException:
                    logger.warning(f"Gemini model '{model_id}' timed out, trying fallback...")
                    continue
                except Exception as e:
                    logger.error(f"Error communicating with Gemini ({model_id}): {e}")
                    last_error = str(e)
                    continue

        logger.error(f"All Gemini model candidates failed: {last_error}")
        yield (
            "Boss, I couldn't reach Google Gemini right now. "
            "Please verify your GEMINI_API_KEY or switch to Groq / Ollama."
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
