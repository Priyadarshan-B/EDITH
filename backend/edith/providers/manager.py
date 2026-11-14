"""
Central Model Manager & Router for EDITH.
Coordinates dynamic model switching between local Ollama, Groq, and Gemini cloud providers.
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
        self.active_model_name: str = settings.models.local.routing_model
        self.active_provider_type: str = self._detect_best_provider()
        self.active_provider: BaseLLMProvider = self._create_provider(
            self.active_provider_type,
            self.active_model_name,
        )

    def _detect_best_provider(self) -> str:
        """Auto-detect best available provider based on configured API keys."""
        if os.environ.get("GROQ_API_KEY", "").strip():
            logger.info("Groq API key found — using Groq as primary cloud provider.")
            return "groq"
        if os.environ.get("GEMINI_API_KEY", "").strip():
            logger.info("Gemini API key found — using Gemini as primary cloud provider.")
            return "gemini"
        return settings.models.primary_provider  # fallback to config (ollama)

    def _create_provider(self, provider_type: str, model_name: str) -> BaseLLMProvider:
        if provider_type == "groq":
            groq_model = model_name if "llama" in model_name or "mixtral" in model_name else "llama-3.1-8b-instant"
            return GroqProvider(model_name=groq_model)
        if provider_type == "gemini":
            return GeminiCloudProvider(model_name=model_name)
        # Default to Ollama local
        threads = 6 if not self.hardware["has_cuda"] else 4
        return OllamaProvider(
            model_name=model_name,
            base_url=settings.models.local.ollama_base_url,
            num_threads=threads,
        )

    async def switch_model(self, model_name: str, provider_type: Optional[str] = None) -> Dict[str, Any]:
        """Dynamically switches the active inference model."""
        if provider_type is None:
            if "gemini" in model_name.lower():
                provider_type = "gemini"
            elif "llama" in model_name.lower() or "mixtral" in model_name.lower() or "groq" in model_name.lower():
                provider_type = "groq"
            else:
                provider_type = "ollama"

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
        """Returns all locally installed models and available cloud models."""
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
                {"name": "llama-3.1-8b-instant", "description": "Groq — Llama 3.1 8B (ultra-fast, free)", "provider": "groq", "available": has_groq_key},
                {"name": "llama-3.1-70b-versatile", "description": "Groq — Llama 3.1 70B (high quality, free)", "provider": "groq", "available": has_groq_key},
                {"name": "mixtral-8x7b-32768", "description": "Groq — Mixtral 8x7B (long context, free)", "provider": "groq", "available": has_groq_key},
                {"name": "gemini-flash-latest", "description": "Google Gemini Flash (fast cloud)", "provider": "gemini", "available": has_gemini_key},
            ],
            "hardware_mode": "cuda_accelerated" if self.hardware["has_cuda"] else "cpu_efficient",
        }

    def get_provider(self) -> BaseLLMProvider:
        return self.active_provider


# Global singleton instance
model_manager = ModelManager()
