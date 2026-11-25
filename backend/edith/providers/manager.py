"""
Central Model Manager & Router for EDITH.
Coordinates dynamic model switching between local Ollama, Groq, and Gemini (Pro & Flash) cloud providers.
"""

from __future__ import annotations
import os
from typing import Dict, Any, List, Optional
from loguru import logger

from edith.config import settings
from edith.providers.base import BaseLLMProvider
from edith.providers.ollama import OllamaProvider
from edith.providers.cloud_gemini import GeminiCloudProvider
from edith.providers.groq_provider import GroqProvider
from edith.providers.hardware import HardwareProfiler


class ModelManager:
    """Manages active LLM provider instance, fallback policies, and dynamic switching."""

    def __init__(self):
        self.hardware = HardwareProfiler.detect_capabilities()
        self.active_provider_type: str = self._detect_best_provider()
        if self.active_provider_type == "gemini":
            self.active_model_name = "gemini-2.5-pro"
        elif self.active_provider_type == "groq":
            self.active_model_name = "openai/gpt-oss-120b"
        else:
            self.active_model_name = settings.models.local.routing_model
        self.active_provider: BaseLLMProvider = self._create_provider(
            self.active_provider_type,
            self.active_model_name,
        )

    def _detect_best_provider(self) -> str:
        """Auto-detect best available provider based on configured API keys."""
        if os.environ.get("GEMINI_API_KEY", "").strip():
            logger.info("Gemini API key found — Gemini Pro ready as primary cloud provider.")
            return "gemini"
        if os.environ.get("GROQ_API_KEY", "").strip():
            logger.info("Groq API key found — using Groq as primary cloud provider.")
            return "groq"
        return settings.models.primary_provider

    def _create_provider(self, provider_type: str, model_name: str) -> BaseLLMProvider:
        if provider_type == "groq":
            return GroqProvider(model_name=model_name)
        if provider_type == "gemini":
            return GeminiCloudProvider(model_name=model_name)
        threads = 6 if not self.hardware["has_cuda"] else 4
        return OllamaProvider(
            model_name=model_name,
            base_url=settings.models.local.ollama_base_url,
            num_threads=threads,
        )

    @staticmethod
    def _infer_provider_type(model_name: str) -> str:
        low = model_name.lower()
        if "gemini" in low or "gemma" in low:
            return "gemini"
        if any(k in low for k in ("llama", "mixtral", "groq", "gpt-oss", "allam", "qwen/qwen3")):
            return "groq"
        return "ollama"

    async def switch_model(self, model_name: str, provider_type: Optional[str] = None) -> Dict[str, Any]:
        """Dynamically switches the active inference model."""
        if provider_type is None:
            provider_type = self._infer_provider_type(model_name)

        logger.info(f"Switching active model to '{model_name}' (Provider: {provider_type})")
        new_provider = self._create_provider(provider_type, model_name)

        self.active_provider = new_provider
        self.active_model_name = model_name
        self.active_provider_type = provider_type

        return {
            "status": "success",
            "active_model": self.active_model_name,
            "provider": self.active_provider_type,
            "available": await new_provider.is_available(),
        }

    async def get_available_models(self) -> Dict[str, Any]:
        """Returns all locally installed models and available Groq & Gemini Pro/Flash cloud models."""
        ollama_models = []
        ollama_prov = OllamaProvider(base_url=settings.models.local.ollama_base_url)
        if await ollama_prov.is_available():
            ollama_models = await ollama_prov.list_installed_models()

        has_gemini_key = bool(os.environ.get("GEMINI_API_KEY", "").strip())
        has_groq_key = bool(os.environ.get("GROQ_API_KEY", "").strip())

        return {
            "active_model": self.active_model_name,
            "active_provider": self.active_provider_type,
            "installed_local_models": ollama_models,
            "suggested_local_models": [
                {"name": "qwen2.5:3b", "description": "Ultra-fast local (Ryzen 5 CPU optimized, ~2GB RAM)", "type": "local"},
                {"name": "qwen2.5:7b", "description": "High reasoning local (~5GB RAM / CUDA VRAM)", "type": "local"},
                {"name": "llama3.2:3b", "description": "Llama 3.2 3B compact local", "type": "local"},
            ],
            "cloud_models": [
                {"name": "gemini-2.5-pro", "description": "Google Gemini 2.5 Pro (Flagship reasoning)", "provider": "gemini", "available": has_gemini_key},
                {"name": "gemini-3.1-pro-preview", "description": "Google Gemini 3.1 Pro Preview (Next-gen Pro)", "provider": "gemini", "available": has_gemini_key},
                {"name": "gemini-2.5-flash", "description": "Google Gemini 2.5 Flash (Ultra-fast cloud)", "provider": "gemini", "available": has_gemini_key},
                {"name": "openai/gpt-oss-120b", "description": "Groq — GPT-OSS 120B (High capability cloud)", "provider": "groq", "available": has_groq_key},
                {"name": "openai/gpt-oss-20b", "description": "Groq — GPT-OSS 20B (Fast cloud)", "provider": "groq", "available": has_groq_key},
                {"name": "qwen/qwen3.8-27b", "description": "Groq — Qwen 3.8 27B (Fast cloud)", "provider": "groq", "available": has_groq_key},
            ],
            "hardware_mode": "cuda_accelerated" if self.hardware["has_cuda"] else "cpu_efficient",
        }

    def get_provider(self) -> BaseLLMProvider:
        return self.active_provider

    @staticmethod
    def is_non_desktop_or_news_query(prompt: str) -> bool:
        """
        Determines whether a prompt is about news, world events, or general knowledge
        rather than desktop/workspace/personal operations.
        """
        low = prompt.lower().strip()
        desktop_or_personal_keywords = (
            "open ", "launch ", "start ", "run ", "close ", "file", "folder",
            "directory", "workspace", "git ", "terminal", "command", "process",
            "window", "cpu", "ram", "memory", "disk", "diagnostic", "virtual mouse",
            "camera mouse", "task", "plan", "reminder", "remind me", "my name",
            "my preference", "build ", "develop ", "create project", "edith",
        )
        if any(kw in low for kw in desktop_or_personal_keywords):
            return False

        online_triggers = (
            "news", "headline", "what happened", "what's happening", "whats happening",
            "latest", "today", "weather", "stock", "price", "crypto", "bitcoin",
            "who is", "who won", "when did", "where is", "why did", "explain ",
            "what is ", "how does ", "history", "science", "sports", "score",
            "movie", "tech", "ai ", "world", "politics", "country", "capital",
        )
        if any(t in low for t in online_triggers):
            return True

        return len(low.split()) >= 4

    def get_provider_for_prompt(self, prompt: str) -> tuple[BaseLLMProvider, str, str]:
        """
        Smart router:
        - News & general non-desktop queries -> Online Cloud LLM (Gemini Pro / Groq, never local Qwen).
        - Desktop / workspace / personal queries -> active selected provider.
        """
        is_local_ollama = (
            self.active_provider_type == "ollama"
            and type(self.active_provider).__name__ == "OllamaProvider"
        )
        if is_local_ollama and self.is_non_desktop_or_news_query(prompt):
            has_gemini = bool(os.environ.get("GEMINI_API_KEY", "").strip())
            has_groq = bool(os.environ.get("GROQ_API_KEY", "").strip())
            if has_gemini:
                return GeminiCloudProvider(model_name="gemini-2.5-pro"), "gemini-2.5-pro", "online_cloud"
            if has_groq:
                return GroqProvider(model_name="openai/gpt-oss-120b"), "openai/gpt-oss-120b", "online_cloud"

        source_mode = "offline_local" if is_local_ollama else "online_cloud"
        actual_model = getattr(self.active_provider, "model_name", self.active_model_name)
        return self.active_provider, actual_model, source_mode


# Global singleton instance
model_manager = ModelManager()
