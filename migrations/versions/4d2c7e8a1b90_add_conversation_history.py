"""add persistent conversation history

Revision ID: 4d2c7e8a1b90
Revises: 19855ff5941b
Create Date: 2026-10-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4d2c7e8a1b90"
down_revision: Union[str, Sequence[str], None] = "19855ff5941b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("connection_id", sa.Integer(), nullable=True),
        sa.Column("messages", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["connection_id"], ["database_connections.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversations_id"), "conversations", ["id"], unique=False)
    op.create_index(op.f("ix_conversations_user_id"), "conversations", ["user_id"], unique=False)
    op.create_index(op.f("ix_conversations_dataset_id"), "conversations", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_conversations_connection_id"), "conversations", ["connection_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_conversations_connection_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_dataset_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_user_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_id"), table_name="conversations")
    op.drop_table("conversations")
