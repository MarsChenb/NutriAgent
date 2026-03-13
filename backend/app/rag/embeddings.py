"""Embedding model wrapper for RAG pipeline."""
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


async def get_embedding(text: str) -> list[float]:
    """Get embedding vector for a text using DeepSeek/OpenAI embedding API.

    Note: DeepSeek may not support embeddings directly.
    We use a simple fallback strategy - if DeepSeek embedding fails,
    we use a hash-based pseudo-embedding for development.
    In production, switch to a dedicated embedding service.
    """
    try:
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
    except Exception:
        # Fallback: use a simple hash-based embedding for development
        return _hash_embedding(text)


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Get embeddings for a batch of texts."""
    try:
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception:
        return [_hash_embedding(text) for text in texts]


def _hash_embedding(text: str, dim: int = 1536) -> list[float]:
    """Generate a deterministic pseudo-embedding from text hash.
    This is for development only - NOT for production use.
    """
    import hashlib
    import math

    result = []
    for i in range(dim):
        h = hashlib.sha256(f"{text}_{i}".encode()).hexdigest()
        # Convert first 8 hex chars to int, normalize to [-1, 1]
        val = (int(h[:8], 16) / 0xFFFFFFFF) * 2 - 1
        result.append(val)

    # Normalize vector length
    norm = math.sqrt(sum(v * v for v in result))
    if norm > 0:
        result = [v / norm for v in result]
    return result
