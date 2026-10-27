import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ai_analtytics_models.database import get_db
from ai_analtytics_models.dependencies import get_current_user
from ai_analtytics_models.models.conversation import Conversation
from ai_analtytics_models.models.dataset import Dataset
from ai_analtytics_models.models.database_connection import DatabaseConnection
from ai_analtytics_models.models.user import User
from ai_analtytics_models.schemas.conversation import (
    ConversationCreate,
    ConversationMessageCreate,
    ConversationRename,
    ConversationResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["Conversation History"])


async def _owned_conversation(conversation_id: int, user_id: int, db: AsyncSession) -> Conversation:
    item = await db.scalar(select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == user_id
    ))
    if item is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return item


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = await db.scalars(select(Conversation).where(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()))
    return list(rows.all())


@router.post("/", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.dataset_id is not None:
        exists = await db.scalar(select(Dataset.id).where(
            Dataset.id == payload.dataset_id, Dataset.user_id == current_user.id
        ))
        if exists is None:
            raise HTTPException(status_code=404, detail="Dataset not found.")
    if payload.connection_id is not None:
        exists = await db.scalar(select(DatabaseConnection.id).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.user_id == current_user.id,
        ))
        if exists is None:
            raise HTTPException(status_code=404, detail="Database connection not found.")
    item = Conversation(
        user_id=current_user.id,
        title=payload.title.strip() or "New analysis",
        source_type=payload.source_type,
        dataset_id=payload.dataset_id,
        connection_id=payload.connection_id,
        messages=[],
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await _owned_conversation(conversation_id, current_user.id, db)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: int,
    payload: ConversationRename,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await _owned_conversation(conversation_id, current_user.id, db)
    item.title = payload.title.strip()
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{conversation_id}/messages", response_model=ConversationResponse)
async def append_conversation_message(
    conversation_id: int,
    payload: ConversationMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await _owned_conversation(conversation_id, current_user.id, db)
    message = payload.model_dump()
    # Replace the JSON list to ensure SQLAlchemy notices the mutation.
    item.messages = [*item.messages, message]
    if item.title == "New analysis" and payload.role == "user":
        item.title = payload.content.strip().splitlines()[0][:80] or "New analysis"
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await _owned_conversation(conversation_id, current_user.id, db)
    await db.delete(item)
    await db.commit()
