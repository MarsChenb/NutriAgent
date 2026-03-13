"""Vector retriever for RAG knowledge base using pgvector."""
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.rag.embeddings import get_embedding


async def retrieve_relevant_chunks(
    db: AsyncSession,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """Retrieve the most relevant knowledge chunks for a query."""
    query_embedding = await get_embedding(query)

    # Use pgvector cosine distance operator
    result = await db.execute(
        select(
            KnowledgeChunk.chunk_text,
            KnowledgeChunk.topic_tag,
            KnowledgeChunk.document_id,
            KnowledgeChunk.embedding.cosine_distance(query_embedding).label("distance"),
        )
        .order_by("distance")
        .limit(top_k)
    )
    rows = result.all()

    chunks = []
    for row in rows:
        # Get document title
        doc_result = await db.execute(
            select(KnowledgeDocument.doc_title).where(
                KnowledgeDocument.id == row.document_id
            )
        )
        doc_title = doc_result.scalar_one_or_none() or "未知来源"

        chunks.append({
            "text": row.chunk_text,
            "topic": row.topic_tag,
            "source": doc_title,
            "distance": float(row.distance),
        })

    return chunks
