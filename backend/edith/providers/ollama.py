"""
Ollama Provider Adapter for EDITH.
Communicates directly with the local Ollama daemon via async HTTP streaming.
"""

from __future__ import annotations
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from loguru import logger

from edith.providers.base import BaseLLMProvider


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
            yield "[Error: Cannot connect to Ollama. Please ensure Ollama is running (`ollama serve`) on your computer.]"
        except Exception as e:
            logger.error(f"Exception during Ollama streaming: {e}")
            yield f"[Ollama Generation Error: {str(e)}]"

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

