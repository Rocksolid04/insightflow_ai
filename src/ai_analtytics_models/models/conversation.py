from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ai_analtytics_models.database import Base


class Conversation(Base):
    """Persist an authenticated user's analysis chat and its evidence payloads."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New analysis")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="dataset")
    dataset_id: Mapped[int | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    connection_id: Mapped[int | None] = mapped_column(
        ForeignKey("database_connections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    messages: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
