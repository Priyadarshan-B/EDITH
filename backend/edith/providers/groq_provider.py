"""
Groq Cloud LLM Provider for EDITH.
Uses Groq's OpenAI-compatible API (free tier, very fast).
Models: llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
"""

from __future__ import annotations
import os
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider


GROQ_API_BASE = "https://api.groq.com/openai/v1"

GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant"


class GroqProvider(BaseLLMProvider):
    """Groq API provider — OpenAI-compatible, free tier, ultra-fast inference."""

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
                "Get a free key at console.groq.com and add GROQ_API_KEY to your .env file."
            )
            return

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            timeout = httpx.Timeout(30.0, connect=8.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{GROQ_API_BASE}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    if response.status_code != 200:
                        err_data = await response.aread()
                        logger.error(f"Groq API error ({response.status_code}): {err_data.decode()}")
                        yield (
                            "Boss, the cloud model ran into a temporary issue. "
                            "Please check your GROQ_API_KEY in .env or retry in a moment."
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

        except httpx.TimeoutException:
            logger.error("Groq API connection timed out.")
            yield (
                "Boss, the cloud connection timed out. "
                "Retry in a moment or install Ollama for offline intelligence."
            )
        except Exception as e:
            logger.error(f"Groq provider error: {e}")
            yield (
                "Boss, I had a brief connection issue. "
                "Desktop controls and system tools are still online."
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
