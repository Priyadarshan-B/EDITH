"""
Central Model Manager & Router for EDITH.
Coordinates dynamic model switching between local Ollama and Cloud providers.
"""

from __future__ import annotations
import os
from typing import Dict, Any, List, Optional
from loguru import logger

from edith.config import settings
from edith.providers.base import BaseLLMProvider
from edith.providers.ollama import OllamaProvider
from edith.providers.cloud_gemini import GeminiCloudProvider
from edith.providers.hardware import HardwareProfiler


class ModelManager:
    """Manages active LLM provider instance, fallback policies, and dynamic switching."""

    def __init__(self):
        self.hardware = HardwareProfiler.detect_capabilities()
        self.active_model_name: str = settings.models.local.routing_model
        self.active_provider_type: str = settings.models.primary_provider
        self.active_provider: BaseLLMProvider = self._create_provider(
            self.active_provider_type,
            self.active_model_name,
        )

    def _create_provider(self, provider_type: str, model_name: str) -> BaseLLMProvider:
        if provider_type == "gemini":
            return GeminiCloudProvider(model_name=model_name)
        else:
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
                {"name": "gemini-1.5-flash", "description": "Fast cloud multimodal (Google)", "available": has_gemini_key},
                {"name": "gemini-1.5-pro", "description": "Deep reasoning cloud (Google)", "available": has_gemini_key},
            ],
            "hardware_mode": "cuda_accelerated" if self.hardware["has_cuda"] else "cpu_efficient",
        }

    def get_provider(self) -> BaseLLMProvider:
        return self.active_provider


# Global singleton instance
model_manager = ModelManager()
