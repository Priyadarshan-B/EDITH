"""
Pytest suite for EDITH LLM Provider Abstraction & Chat Streaming.
"""

from typing import AsyncGenerator, List, Dict
import pytest
from fastapi.testclient import TestClient

from edith.server import create_app
from edith.providers.base import BaseLLMProvider
from edith.providers.manager import model_manager


class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider for testing streaming SSE and persistence."""

    async def is_available(self) -> bool:
        return True

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        tokens = ["Protocol ", "verified. ", "EDITH ", "is ", "standing ", "by."]
        for token in tokens:
            yield token

    async def generate(self, messages, **kwargs) -> str:
        return "Protocol verified. EDITH is standing by."


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_model_manager_discovery():
    """Verify model manager reports installed, suggested, and cloud models."""
    models_info = await model_manager.get_available_models()
    assert "active_model" in models_info
    assert "installed_local_models" in models_info
    assert "suggested_local_models" in models_info


@pytest.mark.asyncio
async def test_model_manager_switching():
    """Verify dynamic switching between models."""
    info = await model_manager.get_available_models()
    assert "suggested_local_models" in info
    assert len(info["suggested_local_models"]) >= 3

    # Switch to 7B model
    switch_res = await model_manager.switch_model("qwen2.5:7b", "ollama")
    assert switch_res["status"] == "success"
    assert model_manager.active_model_name == "qwen2.5:7b"

    # Switch back to 3B
    await model_manager.switch_model("qwen2.5:3b", "ollama")
    assert model_manager.active_model_name == "qwen2.5:3b"


def test_conversation_lifecycle_and_streaming(client):
    """Verify creating conversations, streaming tokens via SSE, and verifying DB storage."""
    # Inject Mock Provider for deterministic token streaming
    original_provider = model_manager.active_provider
    model_manager.active_provider = MockLLMProvider(model_name="mock-edith")

    try:
        # 1. Create a conversation
        create_res = client.post("/api/v1/chat/conversations", json={"title": "Diagnostic Run"})
        assert create_res.status_code == 200
        conv_data = create_res.json()
        conv_id = conv_data["id"]
        assert conv_data["title"] == "Diagnostic Run"

        # 2. Stream tokens via SSE endpoint
        payload = {
            "conversation_id": conv_id,
            "messages": [{"role": "user", "content": "Execute system status check."}],
        }
        stream_res = client.post("/api/v1/chat/stream", json=payload)
        assert stream_res.status_code == 200
        assert "text/event-stream" in stream_res.headers["content-type"]

        # Parse SSE events from response
        raw_text = stream_res.text
        assert "data: " in raw_text
        assert "Protocol " in raw_text
        assert "standing " in raw_text

        # 3. Verify messages are persisted in SQLite
        history_res = client.get(f"/api/v1/chat/conversations/{conv_id}")
        assert history_res.status_code == 200
        messages = history_res.json()
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Execute system status check."
        assert messages[1]["role"] == "assistant"
        assert "Protocol verified. EDITH is standing by." in messages[1]["content"]

        # 4. Verify list conversations includes updated conversation
        list_res = client.get("/api/v1/chat/conversations")
        assert list_res.status_code == 200
        conv_list = list_res.json()
        assert any(c["id"] == conv_id for c in conv_list)

        # 5. Delete conversation
        del_res = client.delete(f"/api/v1/chat/conversations/{conv_id}")
        assert del_res.status_code == 200

        # Verify 404 after deletion
        check_del = client.get(f"/api/v1/chat/conversations/{conv_id}")
        assert check_del.status_code == 404

    finally:
        model_manager.active_provider = original_provider
