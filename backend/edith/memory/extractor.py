"""
Fact Extractor & Memory Consolidator for EDITH.
Analyzes user inputs to extract persistent preferences, workflow conventions, and personal facts.
Synchronizes knowledge across SQLite and ChromaDB vector store.
"""

from __future__ import annotations
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from loguru import logger
from sqlalchemy import select

from edith.memory.database import get_async_session
from edith.memory.models import UserFact
from edith.memory.vector_store import vector_store


# Heuristic patterns for instant, zero-latency local extraction
EXTRACTION_PATTERNS = [
    # Personal Identity
    (
        r"(?:my name is|call me|i am)\s+([A-Za-z0-9_-]+)",
        "personal",
        "User's name is {0}"
    ),
    # Explicit user instruction to remember
    (
        r"(?:remember that|keep in mind that|note that|don't forget that)\s+(.+)",
        "preference",
        "{0}"
    ),
    # Explicit preferences
    (
        r"(?:i prefer|i like|i love|my preference is for)\s+(.+)",
        "preference",
        "User prefers {0}"
    ),
    (
        r"(?:i dislike|i hate|never use|don't ever use)\s+(.+)",
        "preference",
        "User avoids / dislikes {0}"
    ),
    # Coding / Development preferences
    (
        r"(?:always use|default to)\s+(.+?)(?:for my projects|when writing code|as my default)?$",
        "preference",
        "Always use {0}"
    ),
    # Project & Environment context
    (
        r"(?:my main project is|i am working on)\s+(.+)",
        "project",
        "Current active project: {0}"
    ),
    (
        r"(?:my (?:primary|favorite) (?:ide|editor|shell|terminal) is)\s+(.+)",
        "environment",
        "User's environment tool: {0}"
    ),
]


class MemoryExtractor:
    def __init__(self):
        self.patterns = [(re.compile(p, re.IGNORECASE), cat, tmpl) for p, cat, tmpl in EXTRACTION_PATTERNS]

    def extract_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Applies heuristic extraction to find candidate facts in user input.
        Returns a list of dicts with 'category', 'fact_content', and 'confidence'.
        """
        extracted = []
        cleaned = text.strip()
        if not cleaned:
            return extracted

        for pattern, category, template in self.patterns:
            match = pattern.search(cleaned)
            if match:
                val = match.group(1).strip().rstrip(".,!?")
                fact_str = template.format(val)
                extracted.append({
                    "category": category,
                    "fact_content": fact_str,
                    "confidence": 0.95
                })

        return extracted

    async def save_fact(
        self,
        fact_content: str,
        category: str = "preference",
        confidence: float = 1.0
    ) -> Optional[UserFact]:
        """
        Persists a fact to both SQLite and ChromaDB vector store.
        Deduplicates if an exact or near-identical fact already exists.
        """
        fact_content = fact_content.strip()
        if not fact_content:
            return None

        async with get_async_session() as session:
            # Check for existing duplicate
            stmt = select(UserFact).where(UserFact.fact_content == fact_content)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.last_verified = datetime.utcnow()
                existing.confidence_score = max(existing.confidence_score, confidence)
                await session.commit()
                # Re-index in ChromaDB
                await vector_store.add_fact(
                    fact_id=existing.id,
                    content=existing.fact_content,
                    category=existing.category,
                    confidence=existing.confidence_score,
                )
                logger.info(f"Updated existing user fact '{existing.id}': {fact_content}")
                return existing

            new_fact = UserFact(
                category=category,
                fact_content=fact_content,
                confidence_score=confidence,
                created_at=datetime.utcnow(),
                last_verified=datetime.utcnow(),
            )
            session.add(new_fact)
            await session.commit()
            await session.refresh(new_fact)

            # Sync to ChromaDB
            await vector_store.add_fact(
                fact_id=new_fact.id,
                content=new_fact.fact_content,
                category=new_fact.category,
                confidence=new_fact.confidence_score,
            )
            logger.info(f"Persisted new user fact '{new_fact.id}': {fact_content}")
            return new_fact

    async def auto_extract_and_persist(self, user_message: str) -> List[UserFact]:
        """
        Analyzes user message, extracts candidate facts, and commits them to memory.
        """
        candidates = self.extract_from_text(user_message)
        saved = []
        for cand in candidates:
            fact = await self.save_fact(
                fact_content=cand["fact_content"],
                category=cand["category"],
                confidence=cand["confidence"],
            )
            if fact:
                saved.append(fact)
        return saved

    async def retrieve_relevant_facts(self, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """
        Queries ChromaDB for semantically similar user facts and preferences.
        """
        return await vector_store.search_facts(query, limit=limit)


# Global singleton instance
memory_extractor = MemoryExtractor()
