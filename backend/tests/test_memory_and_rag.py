"""
Tests for EDITH Semantic Vector Memory, FastEmbed, and RAG Extraction Engine.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from edith.server import create_app
from edith.memory.embeddings import embedding_engine
from edith.memory.vector_store import vector_store
from edith.memory.extractor import memory_extractor


@pytest.mark.asyncio
async def test_pseudo_and_fastembed_vectors():
    """Validates dense 384-dimensional vector creation."""
    sample_text = "Iron Man mark 85 personal defense AI system."
    vector = embedding_engine.embed_query(sample_text)

    assert isinstance(vector, list)
    assert len(vector) == 384
    # Check that another call on identical text produces identical embedding
    vector2 = embedding_engine.embed_query(sample_text)
    assert vector == vector2


@pytest.mark.asyncio
async def test_heuristic_extractor_patterns():
    """Validates heuristic pattern extraction for instant fact capture."""
    # 1. Identity
    facts = memory_extractor.extract_from_text("My name is Stark.")
    assert len(facts) >= 1
    assert facts[0]["category"] == "personal"
    assert "Stark" in facts[0]["fact_content"]

    # 2. Preference
    facts2 = memory_extractor.extract_from_text("I prefer Python over JavaScript")
    assert len(facts2) >= 1
    assert facts2[0]["category"] == "preference"
    assert "Python" in facts2[0]["fact_content"]

    # 3. Environment
    facts3 = memory_extractor.extract_from_text("My favorite IDE is VS Code")
    assert len(facts3) >= 1
    assert facts3[0]["category"] == "environment"


@pytest.mark.asyncio
async def test_vector_store_add_and_search():
    """Tests indexing facts and semantic vector querying."""
    fact_id = "test_fact_999"
    content = "User prefers dark mode UI and cyan accents."

    success = await vector_store.add_fact(
        fact_id=fact_id,
        content=content,
        category="preference",
        confidence=1.0,
    )
    assert success is True

    # Search for related terms
    results = await vector_store.search_facts("cyan accents and dark theme", limit=3)
    assert isinstance(results, list)
    # Cleanup
    await vector_store.delete_fact(fact_id)


@pytest.mark.asyncio
async def test_memory_api_endpoints():
    """Tests Memory REST API endpoints."""
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a fact
        resp = await client.post(
            "/api/v1/memory/facts",
            json={
                "category": "preference",
                "fact_content": "User prefers concise terminal outputs",
                "confidence_score": 0.9,
            },
        )
        assert resp.status_code == 200
        fact_data = resp.json()
        assert fact_data["category"] == "preference"
        fact_id = fact_data["id"]

        # 2. List facts
        resp = await client.get("/api/v1/memory/facts")
        assert resp.status_code == 200
        facts_list = resp.json()
        assert any(f["id"] == fact_id for f in facts_list)

        # 3. Semantic Query
        resp = await client.post(
            "/api/v1/memory/query",
            json={"query": "terminal output format", "limit": 2},
        )
        assert resp.status_code == 200
        query_results = resp.json()
        assert isinstance(query_results, list)

        # 4. Delete fact
        resp = await client.delete(f"/api/v1/memory/facts/{fact_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

