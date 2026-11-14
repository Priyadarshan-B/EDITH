"""
Local Text Embedding Generator using FastEmbed (ONNX Runtime).
Produces fast, dense vector representations offline without PyTorch overhead.
"""

from __future__ import annotations
import os
import hashlib
from pathlib import Path
import numpy as np
from typing import List
from loguru import logger

from edith.config import settings
from edith.providers.hardware import HardwareProfiler


class EmbeddingEngine:
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.hardware = HardwareProfiler.detect_capabilities()
        self._model = None
        self._init_model()

    def _init_model(self):
        """Initializes FastEmbed TextEmbedding ONNX model if cached or enabled."""
        cache_path = Path("models/embeddings")
        has_cached_model = cache_path.exists() and any(cache_path.rglob("*.onnx"))

        # Skip slow remote downloads if offline or not pre-cached
        allow_remote = os.environ.get("EDITH_ALLOW_REMOTE_MODELS", "0") == "1"
        if not has_cached_model and not allow_remote:
            logger.info("FastEmbed: Offline mode active. Using local deterministic 384-dim vector engine.")
            self._model = None
            return

        try:
            from fastembed import TextEmbedding
            threads = 4 if not self.hardware["has_cuda"] else None
            logger.info(f"Initializing FastEmbed model '{self.model_name}' (CUDA: {self.hardware['has_cuda']})...")
            self._model = TextEmbedding(
                model_name=self.model_name,
                threads=threads,
                cache_dir="models/embeddings",
                local_files_only=not allow_remote,
            )
            logger.info("FastEmbed engine ready.")
        except Exception as e:
            logger.warning(f"FastEmbed initialization notice: {e}. Fallback vector generator active.")
            self._model = None

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generates 384-dimensional dense embedding vectors for a batch of strings."""
        if not texts:
            return []

        if self._model is not None:
            try:
                embeddings_gen = self._model.embed(texts)
                return [arr.tolist() for arr in embeddings_gen]
            except Exception as e:
                logger.error(f"Error during FastEmbed inference: {e}")

        # High-dimensional deterministic projection fallback (384 dimensions)
        return [self._pseudo_embedding(t, dim=384) for t in texts]

    def embed_query(self, query: str) -> List[float]:
        """Embeds a single query string."""
        return self.embed_texts([query])[0]

    def _pseudo_embedding(self, text: str, dim: int = 384) -> List[float]:
        """Deterministic pseudo-random unit vector based on text hash for testing/offline fallback."""
        seed = int(hashlib.md5(text.lower().encode("utf-8")).hexdigest()[:8], 16)
        rng = np.random.RandomState(seed)
        vec = rng.randn(dim)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()


# Global singleton instance
embedding_engine = EmbeddingEngine()
