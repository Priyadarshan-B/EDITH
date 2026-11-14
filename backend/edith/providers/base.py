"""
Abstract Base LLM Provider for EDITH.
Defines standard interfaces for local and cloud LLM execution.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any, Optional


class BaseLLMProvider(ABC):
    """Abstract interface that all LLM runtime adapters must satisfy."""

    def __init__(self, model_name: str, config: Optional[Dict[str, Any]] = None):
        self.model_name = model_name
        self.config = config or {}

    @abstractmethod
    async def is_available(self) -> bool:
        """Checks if the provider service is reachable and model is ready."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Streams text chunks token-by-token from the LLM."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> str:
        """Executes a full non-streaming completion."""
        pass

    def get_model_name(self) -> str:
        return self.model_name

