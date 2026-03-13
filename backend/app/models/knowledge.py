from datetime import datetime

from sqlalchemy import BigInteger, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.models import Base


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    doc_title: Mapped[str | None] = mapped_column(String(255))
    doc_source: Mapped[str | None] = mapped_column(String(255))
    doc_type: Mapped[str | None] = mapped_column(String(64))  # guideline/pdf/web/faq
    source_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_id: Mapped[int | None] = mapped_column(BigInteger)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int | None] = mapped_column(Integer)
    topic_tag: Mapped[str | None] = mapped_column(String(64))
    embedding = mapped_column(Vector(1536), nullable=True)
