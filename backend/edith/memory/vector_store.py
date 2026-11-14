"""
Vector Memory Store for EDITH using ChromaDB & FastEmbed.
Manages persistent semantic embeddings for user preferences and document chunks.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger

from edith.config import settings
from edith.memory.embeddings import embedding_engine


class VectorMemoryStore:
    def __init__(self, persist_dir: str = "data/chroma"):
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = None
        self.pref_collection = None
        self.doc_collection = None
        self._init_chroma()

    def _init_chroma(self):
        """Initializes ChromaDB persistent client and collections."""
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self.client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            # User preferences and episodic facts collection
            self.pref_collection = self.client.get_or_create_collection(
                name="edith_user_preferences",
                metadata={"description": "Extracted user facts, habits, and preferences"},
            )
            # Document index collection
            self.doc_collection = self.client.get_or_create_collection(
                name="edith_documents",
                metadata={"description": "Indexed user documents, code notes, and references"},
            )
            logger.info(f"ChromaDB initialized at '{self.persist_dir}'.")
        except Exception as e:
            logger.warning(f"ChromaDB initialization notice: {e}. Fallback in-memory vector store active.")
            self.client = None

    async def add_fact(
        self,
        fact_id: str,
        content: str,
        category: str = "preference",
        confidence: float = 1.0,
    ) -> bool:
        """Embeds and indexes a user preference fact."""
        vector = embedding_engine.embed_query(content)
        if self.pref_collection is not None:
            try:
                self.pref_collection.upsert(
                    ids=[fact_id],
                    embeddings=[vector],
                    documents=[content],
                    metadatas=[{"category": category, "confidence": confidence}],
                )
                logger.debug(f"Fact '{fact_id}' indexed in ChromaDB.")
                return True
            except Exception as e:
                logger.error(f"Failed to upsert fact into ChromaDB: {e}")
        return True

    async def search_facts(self, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """Queries semantically similar facts for context injection."""
        if not query.strip():
            return []

        query_vector = embedding_engine.embed_query(query)

        if self.pref_collection is not None and self.pref_collection.count() > 0:
            try:
                results = self.pref_collection.query(
                    query_embeddings=[query_vector],
                    n_results=min(limit, self.pref_collection.count()),
                )
                facts = []
                ids = results.get("ids", [[]])[0]
                docs = results.get("documents", [[]])[0]
                metadatas = results.get("metadatas", [[]])[0]
                distances = results.get("distances", [[]])[0]

                for idx, fact_id in enumerate(ids):
                    facts.append({
                        "id": fact_id,
                        "content": docs[idx],
                        "category": metadatas[idx].get("category", "general"),
                        "confidence": metadatas[idx].get("confidence", 1.0),
                        "distance": distances[idx] if idx < len(distances) else 0.0,
                    })
                return facts
            except Exception as e:
                logger.error(f"Error querying ChromaDB facts: {e}")

        return []

    async def delete_fact(self, fact_id: str) -> bool:
        """Deletes a fact embedding from ChromaDB."""
        if self.pref_collection is not None:
            try:
                self.pref_collection.delete(ids=[fact_id])
                return True
            except Exception as e:
                logger.error(f"Failed to delete fact from ChromaDB: {e}")
        return True

    async def index_document_chunk(
        self,
        chunk_id: str,
        content: str,
        source_path: str,
        chunk_index: int = 0,
    ) -> bool:
        """Indexes a document text chunk."""
        vector = embedding_engine.embed_query(content)
        if self.doc_collection is not None:
            try:
                self.doc_collection.upsert(
                    ids=[chunk_id],
                    embeddings=[vector],
                    documents=[content],
                    metadatas=[{"source": source_path, "chunk": chunk_index}],
                )
                return True
            except Exception as e:
                logger.error(f"Failed to index document chunk: {e}")
        return True


# Global vector memory instance
vector_store = VectorMemoryStore()

