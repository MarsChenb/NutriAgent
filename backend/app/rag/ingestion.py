"""Document ingestion pipeline for RAG knowledge base."""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.config import settings
from app.models import Base
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk
from app.rag.embeddings import get_embedding

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent.parent / "seeds" / "knowledge"


def split_markdown_into_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
    """Split markdown text into chunks, preserving section headers."""
    chunks = []
    sections = text.split("\n## ")

    for i, section in enumerate(sections):
        if i == 0 and not section.startswith("# "):
            continue
        if i > 0:
            section = "## " + section

        # Extract section header
        lines = section.strip().split("\n")
        header = lines[0].strip("# ").strip() if lines else ""

        # Split long sections
        content = "\n".join(lines)
        if len(content) <= chunk_size:
            chunks.append({"text": content, "topic": header})
        else:
            # Split by sub-sections or paragraphs
            sub_sections = content.split("\n### ")
            for j, sub in enumerate(sub_sections):
                if j > 0:
                    sub = "### " + sub
                sub = sub.strip()
                if not sub:
                    continue

                # Further split if still too long
                while len(sub) > chunk_size:
                    split_point = sub.rfind("\n", 0, chunk_size)
                    if split_point == -1:
                        split_point = chunk_size
                    chunk_text = sub[:split_point].strip()
                    if chunk_text:
                        chunks.append({"text": chunk_text, "topic": header})
                    sub = sub[split_point - overlap:].strip()

                if sub:
                    chunks.append({"text": sub, "topic": header})

    return chunks


async def ingest_document(session: AsyncSession, file_path: Path):
    """Ingest a single markdown document into the knowledge base."""
    doc_title = file_path.stem.replace("_", " ").title()
    print(f"Ingesting: {doc_title}")

    # Check if already ingested
    result = await session.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.doc_title == doc_title)
    )
    existing = result.scalar_one_or_none()
    if existing:
        print(f"  Already exists, skipping.")
        return

    # Read and split document
    content = file_path.read_text(encoding="utf-8")
    chunks = split_markdown_into_chunks(content)
    print(f"  Split into {len(chunks)} chunks")

    # Create document record
    doc = KnowledgeDocument(
        doc_title=doc_title,
        doc_source=str(file_path.name),
        doc_type="markdown",
    )
    session.add(doc)
    await session.flush()

    # Insert chunks with embeddings
    for i, chunk_data in enumerate(chunks):
        chunk_text = chunk_data["text"]
        topic = chunk_data["topic"]

        embedding = await get_embedding(chunk_text)

        chunk = KnowledgeChunk(
            document_id=doc.id,
            chunk_text=chunk_text,
            chunk_index=i,
            topic_tag=topic,
            embedding=embedding,
        )
        session.add(chunk)

    await session.commit()
    print(f"  Ingested {len(chunks)} chunks with embeddings")


async def ingest_all():
    """Ingest all knowledge documents."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    md_files = list(KNOWLEDGE_DIR.glob("*.md"))
    print(f"Found {len(md_files)} knowledge documents")

    async with session_factory() as session:
        for file_path in md_files:
            await ingest_document(session, file_path)

    await engine.dispose()
    print("Knowledge base ingestion complete!")


if __name__ == "__main__":
    asyncio.run(ingest_all())
