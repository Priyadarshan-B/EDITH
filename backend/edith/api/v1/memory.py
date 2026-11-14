"""
Memory & Semantic Knowledge API endpoints for EDITH.
Allows querying, creating, managing, and deleting persistent user facts and preferences.
"""

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, delete
from loguru import logger

from edith.memory.database import get_async_session
from edith.memory.models import UserFact
from edith.memory.extractor import memory_extractor
from edith.memory.vector_store import vector_store

router = APIRouter(prefix="/memory", tags=["Semantic Memory"])


class FactCreateRequest(BaseModel):
    category: str = Field(default="preference", description="Fact category: preference, personal, project, environment")
    fact_content: str = Field(..., min_length=2, description="The textual fact or preference")
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)


class FactResponse(BaseModel):
    id: str
    category: str
    fact_content: str
    confidence_score: float
    created_at: str
    last_verified: str


class SemanticQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic search query")
    limit: int = Field(default=5, ge=1, le=20)


class SemanticQueryResultItem(BaseModel):
    id: str
    content: str
    category: str
    confidence: float
    distance: float


class ExtractRequest(BaseModel):
    text: str = Field(..., min_length=2, description="User text to extract facts from")
    auto_save: bool = Field(default=True, description="Whether to immediately commit extracted facts")


@router.get("/facts", response_model=List[FactResponse])
async def list_facts(category: Optional[str] = None):
    """Retrieves all persistent user facts stored in memory."""
    async with get_async_session() as session:
        stmt = select(UserFact).order_by(UserFact.created_at.desc())
        if category:
            stmt = stmt.where(UserFact.category == category)
        result = await session.execute(stmt)
        facts = result.scalars().all()
        return [
            FactResponse(
                id=f.id,
                category=f.category,
                fact_content=f.fact_content,
                confidence_score=f.confidence_score,
                created_at=f.created_at.isoformat(),
                last_verified=f.last_verified.isoformat(),
            )
            for f in facts
        ]


@router.post("/facts", response_model=FactResponse)
async def create_fact(payload: FactCreateRequest):
    """Manually registers a new fact or preference into long-term memory."""
    fact = await memory_extractor.save_fact(
        fact_content=payload.fact_content,
        category=payload.category,
        confidence=payload.confidence_score,
    )
    if not fact:
        raise HTTPException(status_code=400, detail="Could not store fact.")

    return FactResponse(
        id=fact.id,
        category=fact.category,
        fact_content=fact.fact_content,
        confidence_score=fact.confidence_score,
        created_at=fact.created_at.isoformat(),
        last_verified=fact.last_verified.isoformat(),
    )


@router.delete("/facts/{fact_id}")
async def delete_fact(fact_id: str):
    """Deletes a fact from both SQLite database and ChromaDB vector collection."""
    async with get_async_session() as session:
        stmt = select(UserFact).where(UserFact.id == fact_id)
        result = await session.execute(stmt)
        fact = result.scalar_one_or_none()
        if not fact:
            raise HTTPException(status_code=404, detail="Fact not found.")

        await session.delete(fact)
        await session.commit()

    # Remove from ChromaDB
    await vector_store.delete_fact(fact_id)
    return {"status": "success", "message": f"Fact '{fact_id}' deleted."}


@router.post("/query", response_model=List[SemanticQueryResultItem])
async def query_facts(payload: SemanticQueryRequest):
    """Executes dense semantic vector similarity retrieval on user facts."""
    results = await vector_store.search_facts(payload.query, limit=payload.limit)
    return [
        SemanticQueryResultItem(
            id=r["id"],
            content=r["content"],
            category=r["category"],
            confidence=r["confidence"],
            distance=r["distance"],
        )
        for r in results
    ]


@router.post("/extract")
async def extract_facts_from_text(payload: ExtractRequest):
    """Analyzes text for candidate facts, optionally committing them."""
    if payload.auto_save:
        saved = await memory_extractor.auto_extract_and_persist(payload.text)
        return {
            "status": "success",
            "saved_count": len(saved),
            "facts": [
                {
                    "id": f.id,
                    "category": f.category,
                    "content": f.fact_content,
                }
                for f in saved
            ]
        }
    else:
        candidates = memory_extractor.extract_from_text(payload.text)
        return {
            "status": "success",
            "candidate_count": len(candidates),
            "candidates": candidates,
        }

