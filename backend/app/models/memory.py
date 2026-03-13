from datetime import datetime

from sqlalchemy import BigInteger, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.models import Base


class LongTermMemory(Base):
    __tablename__ = "long_term_memories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    memory_type: Mapped[str | None] = mapped_column(String(64))  # goal/preference/restriction/habit
    memory_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(1536), nullable=True)
    importance_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    created_at: Mapped[datetime] = mapped_column(default=func.now())


class ConversationHistory(Base):
    __tablename__ = "conversation_histories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user/assistant/system
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
