"""
Google Gemini Cloud Provider for EDITH.
Streams completions directly from Google Gemini API endpoints.
"""

from __future__ import annotations
import os
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider


class GeminiCloudProvider(BaseLLMProvider):
    """Google Gemini API provider (e.g. gemini-1.5-flash, gemini-1.5-pro)."""

    def __init__(
        self,
        model_name: str = "gemini-1.5-flash",
        api_key: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(model_name, config)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")

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
            yield "[Error: GEMINI_API_KEY is not configured. Add it in settings or environment variables.]"
            return

        # Convert standard OpenAI-style messages to Gemini contents structure
        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:streamGenerateContent?key={self.api_key}&alt=sse"

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            },
        }
        if max_tokens:
            payload["generationConfig"]["maxOutputTokens"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_data = await response.aread()
                        yield f"[Gemini API Error {response.status_code}: {err_data.decode('utf-8', errors='replace')}]"
                        return

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
                                            yield text
                            except json.JSONDecodeError:
                                continue

        except Exception as e:
            logger.error(f"Error communicating with Gemini: {e}")
            yield f"[Gemini Request Failed: {str(e)}]"

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
