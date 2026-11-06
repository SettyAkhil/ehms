"""Embedding generation and vector similarity search for clinical documents.

Embeddings are generated via the local vLLM server's embedding endpoint (no API key,
no cloud dependency) rather than a cloud embedding API or a heavy in-process PyTorch model.

Vectors are stored as JSON-encoded float arrays (portable across SQLite and Postgres)
and compared via cosine similarity in Python. This works identically on both database
engines without requiring the Postgres `vector` extension to be pre-installed; upgrading
a specific deployment to native pgvector indexing later is a storage-layer optimization,
not a change to this module's interface.
"""

import json
import logging
import math
import os

import requests

# All values come from the environment (deploy/.env); nothing is defaulted here.
VLLM_EMBEDDING_URL = os.getenv("VLLM_EMBEDDING_URL", "").rstrip("/")
VLLM_EMBEDDING_MODEL = os.getenv("VLLM_EMBEDDING_MODEL", "")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "")


def generate_embedding(text: str):
    """Return a float vector for the given text, or None if embeddings are unavailable."""
    text = (text or "").strip()
    if not text:
        return None
    if not VLLM_EMBEDDING_URL or not VLLM_EMBEDDING_MODEL:
        logging.getLogger(__name__).error(
            "Embeddings not configured: set VLLM_EMBEDDING_URL and VLLM_EMBEDDING_MODEL")
        return None
    try:
        headers = {"Content-Type": "application/json"}
        if VLLM_API_KEY:
            headers["Authorization"] = f"Bearer {VLLM_API_KEY}"

        resp = requests.post(
            f"{VLLM_EMBEDDING_URL}/embeddings",
            json={"model": VLLM_EMBEDDING_MODEL, "input": text},
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if data and len(data) > 0:
            values = data[0].get("embedding")
            return list(values) if values else None
        return None
    except Exception:
        return None


def cosine_similarity(vector_a, vector_b) -> float:
    if not vector_a or not vector_b or len(vector_a) != len(vector_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vector_a, vector_b))
    norm_a = math.sqrt(sum(a * a for a in vector_a))
    norm_b = math.sqrt(sum(b * b for b in vector_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def encode_vector(vector) -> str:
    return json.dumps(vector, separators=(",", ":"))


def decode_vector(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None
