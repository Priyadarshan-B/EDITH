"""
Ollama Provider Adapter for EDITH.
Communicates directly with the local Ollama daemon via async HTTP streaming.
"""

from __future__ import annotations
import json
import os
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider
from edith.config import settings


class OllamaProvider(BaseLLMProvider):
    """Integrates local Ollama models (Qwen 2.5, Llama 3.2, etc.)."""

    def __init__(
        self,
        model_name: str = "qwen2.5:3b",
        base_url: str = "http://127.0.0.1:11434",
        num_threads: int = 6,
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(model_name, config)
        self.base_url = base_url.rstrip("/")
        self.num_threads = num_threads

    async def is_available(self) -> bool:
        """Verifies Ollama is running and responsive."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def list_installed_models(self) -> List[str]:
        """Returns names of all models currently pulled into Ollama."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.warning(f"Could not retrieve Ollama models list: {e}")
        return []

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Streams tokens from Ollama /api/chat."""
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_thread": self.num_threads,
            },
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        logger.error(f"Ollama error {response.status_code}: {err_text.decode('utf-8', errors='replace')}")
                        yield f"[Ollama Error: Status {response.status_code}. Is '{self.model_name}' downloaded? Run 'ollama pull {self.model_name}']"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            if "message" in chunk and "content" in chunk["message"]:
                                content = chunk["message"]["content"]
                                if content:
                                    yield content
                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

        except httpx.ConnectError:
            gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
            if gemini_key:
                from edith.providers.cloud_gemini import GeminiCloudProvider
                gemini_prov = GeminiCloudProvider()
                logger.info("Ollama unreachable: Automatically falling back to Gemini Cloud provider.")
                async for chunk in gemini_prov.generate_stream(messages, temperature=temperature, max_tokens=max_tokens):
                    yield chunk
                return

            u_title = settings.user.title or "Boss"
            fallback_greeting = (
                f"Right away, {u_title}. My local Ollama neural engine is currently unreachable on port 11434.\n\n"
                f"To enable offline conversational reasoning for general queries:\n"
                f"1. Start Ollama with `ollama serve` in a terminal.\n"
                f"2. Or switch to Gemini Cloud in the model selector above if you have an API key configured.\n\n"
                f"All desktop actions (`open <app>`, `find files`, `active window`, `diagnostics`), task management, and system automations remain 100% online and at your command, {u_title}."
            )
            for word in fallback_greeting.split(" "):
                yield word + " "
        except Exception as e:
            logger.error(f"Exception during Ollama streaming: {e}")
            yield (
                "Boss, I couldn't reach the local neural engine (`qwen2.5:3b`).\n\n"
                "Please verify Ollama is running (`ollama serve`), or configure Gemini Cloud in the model switcher above. "
                "All desktop actions and system controls remain ready at your service."
            )

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> str:
        """Full non-streaming response."""
        chunks = []
        async for chunk in self.generate_stream(messages, temperature, max_tokens, **kwargs):
            chunks.append(chunk)
        return "".join(chunks)

