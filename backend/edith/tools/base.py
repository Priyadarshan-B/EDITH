"""
Base Tool Definition for EDITH Native Orchestration.
Every tool declares a Pydantic parameter schema, an ActionRiskTier, execution logic, and post-verification.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Type, Dict, Any, Optional
from pydantic import BaseModel
from edith.security.permissions import ActionRiskTier


class ToolExecutionResult(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str
    verified: bool = False


class BaseTool(ABC):
    """Abstract base class for all EDITH desktop and system automation tools."""

    name: str
    description: str
    risk_tier: ActionRiskTier
    parameters_schema: Type[BaseModel]

    @abstractmethod
    async def execute(self, **kwargs) -> ToolExecutionResult:
        """Executes the tool logic with validated keyword arguments."""
        pass

    @abstractmethod
    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        """
        Actively inspects the OS, process table, or filesystem to prove the action succeeded.
        EDITH never claims success without verification.
        """
        pass

    def get_openai_tool_schema(self) -> Dict[str, Any]:
        """Generates OpenAI-compatible function calling declaration."""
        schema = self.parameters_schema.model_json_schema()
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        }

