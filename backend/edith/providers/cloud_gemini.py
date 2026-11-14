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
        model_name: str = "gemini-flash-latest",
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
            yield "Boss, cloud conversational reasoning is offline because no API key is configured. You can start Ollama locally (`ollama serve`) or configure a Gemini key in settings."
            return

        # Model name: default to Google's recommended gemini-3.8-flash
        model_id = self.model_name
        if model_id in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.2-flash"]:
            model_id = "gemini-3.8-flash"

        # Convert standard OpenAI-style messages to Gemini contents structure
        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:streamGenerateContent?key={self.api_key}&alt=sse"

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            },
        }
        if max_tokens:
            payload["generationConfig"]["maxOutputTokens"] = max_tokens

        try:
            # 8s connect timeout, 30s read timeout
            timeout = httpx.Timeout(30.0, connect=8.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_data = await response.aread()
                        err_text = err_data.decode("utf-8", errors="replace")
                        logger.error(f"Gemini API error (Status {response.status_code}): {err_text}")
                        # Polite user-facing message with alternatives, without dumping raw technical stack traces
                        yield (
                            "Boss, I couldn't reach the cloud model right now.\n\n"
                            "As an alternative, you can run Ollama completely offline on your computer (`ollama serve`), "
                            "or check your API key in the environment file. In the meantime, all desktop commands, "
                            "application launching, and system tools are ready for you."
                        )
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

        except httpx.TimeoutException:
            logger.error("Connection to Gemini Cloud timed out.")
            yield (
                "Boss, the cloud connection timed out while processing your request.\n\n"
                "You can run Ollama locally for zero-latency offline intelligence, or retry in a moment."
            )
        except Exception as e:
            logger.error(f"Error communicating with Gemini: {e}")
            yield (
                "Boss, I experienced a connection interruption with the cloud provider.\n\n"
                "Desktop controls and system tools remain online. To chat offline without internet, you can start Ollama with `ollama serve`."
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

