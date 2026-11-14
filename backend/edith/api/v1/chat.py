"""
Chat and Streaming Endpoints for EDITH.
Handles conversation persistence, model routing, and token streaming.
"""

from __future__ import annotations
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from edith.memory.database import get_db_session
from edith.memory.models import Conversation, Message
from edith.providers.manager import model_manager

router = APIRouter(prefix="/chat", tags=["Chat"])


# --- Schemas ---

class SwitchModelRequest(BaseModel):
    model_name: str
    provider: Optional[str] = None


class MessageIn(BaseModel):
    role: str = "user"
    content: str


class ChatStreamRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[MessageIn]
    temperature: float = 0.7
    max_tokens: Optional[int] = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    model_used: Optional[str]
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"


# --- Endpoints ---

@router.get("/models")
async def list_models() -> Dict[str, Any]:
    """Returns available local and cloud models with active selection."""
    return await model_manager.get_available_models()


@router.post("/models/switch")
async def switch_model(payload: SwitchModelRequest) -> Dict[str, Any]:
    """Switches the active AI model dynamically."""
    return await model_manager.switch_model(payload.model_name, payload.provider)


@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> List[ConversationOut]:
    """Lists recent conversations with message counts."""
    query = (
        select(Conversation)
        .where(Conversation.is_archived == False)
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
    )
    result = await db.execute(query)
    conversations = result.scalars().all()

    output = []
    for conv in conversations:
        # Get count of messages
        count_q = select(Message).where(Message.conversation_id == conv.id)
        count_res = await db.execute(count_q)
        msg_count = len(count_res.scalars().all())

        output.append(
            ConversationOut(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=msg_count,
            )
        )
    return output


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(
    payload: CreateConversationRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ConversationOut:
    """Creates a new empty conversation."""
    conv = Conversation(
        title=payload.title or "New Conversation",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=List[MessageOut])
async def get_conversation_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> List[MessageOut]:
    """Retrieves all messages for a specific conversation in chronological order."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    result = await db.execute(query)
    messages = result.scalars().all()

    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            model_used=m.model_used,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, str]:
    """Deletes a conversation and its messages."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    await db.delete(conv)
    await db.commit()
    return {"status": "deleted", "id": conversation_id}


@router.post("/stream")
async def chat_stream(
    payload: ChatStreamRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Streams LLM tokens using Server-Sent Events (SSE) and persists both
    the user prompt and assistant response to SQLite.
    """
    provider = model_manager.get_provider()
    model_name = model_manager.active_model_name

    # Validate or create conversation
    conv_id = payload.conversation_id
    if not conv_id:
        # Create a new conversation using the first 35 chars of user prompt as title
        first_user_msg = next((m.content for m in payload.messages if m.role == "user"), "New Chat")
        clean_title = first_user_msg.strip().replace("\n", " ")[:35] or "New Chat"
        conv = Conversation(title=clean_title)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        conv_id = conv.id
    else:
        conv = await db.get(Conversation, conv_id)
        if conv:
            conv.updated_at = datetime.utcnow()
            await db.commit()

    # Save incoming user message
    last_user_msg = payload.messages[-1]
    if last_user_msg.role == "user":
        user_record = Message(
            conversation_id=conv_id,
            role="user",
            content=last_user_msg.content,
            model_used=None,
        )
        db.add(user_record)
        await db.commit()

    # Format messages for provider
    formatted_messages = [
        {"role": m.role, "content": m.content} for m in payload.messages
    ]

    # Prepend EDITH System Identity Prompt
    system_prompt = {
        "role": "system",
        "content": (
            "You are EDITH (Even Dead, I'm The Hero), an advanced personal AI operating assistant "
            "inspired by Tony Stark's assistive intelligence. You are knowledgeable, precise, and proactive. "
            "Provide helpful, concise, well-structured answers using markdown formatting with code blocks "
            "when writing scripts or code."
        ),
    }
    llm_input = [system_prompt] + formatted_messages

    async def sse_event_generator():
        collected_chunks = []
        assistant_msg_id = str(uuid.uuid4())

        # Yield conversation metadata event
        meta_event = {
            "type": "start",
            "conversation_id": conv_id,
            "message_id": assistant_msg_id,
            "model": model_name,
        }
        yield f"data: {json.dumps(meta_event)}\n\n"

        # Stream tokens from active provider
        try:
            async for token in provider.generate_stream(
                llm_input,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
            ):
                collected_chunks.append(token)
                token_event = {"type": "token", "content": token}
                yield f"data: {json.dumps(token_event)}\n\n"

        except Exception as e:
            logger.error(f"Error during token streaming: {e}")
            err_event = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(err_event)}\n\n"

        full_content = "".join(collected_chunks)

        # Persist assistant message in a fresh session to avoid async generator lifecycle race
        try:
            from edith.memory.database import AsyncSessionLocal
            async with AsyncSessionLocal() as save_db:
                assistant_record = Message(
                    id=assistant_msg_id,
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_content,
                    model_used=model_name,
                    tokens_used=len(full_content.split()),
                )
                save_db.add(assistant_record)
                await save_db.commit()
        except Exception as e:
            logger.error(f"Failed to persist assistant response to SQLite: {e}")

        # Yield completion event
        done_event = {
            "type": "done",
            "conversation_id": conv_id,
            "message_id": assistant_msg_id,
            "total_tokens": len(full_content.split()),
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

