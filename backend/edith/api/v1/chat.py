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
from edith.memory.vector_store import vector_store
from edith.memory.extractor import memory_extractor
from edith.memory.learner import continuous_learner
from edith.providers.manager import model_manager
from edith.providers.news_lookup import needs_live_news, fetch_news_context
from edith.config import settings

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
    provider, model_name, source_mode = model_manager.get_provider_for_prompt(last_user_msg.content)
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

    # Retrieve semantically relevant facts from vector memory
    memory_context = ""
    try:
        relevant_facts = await vector_store.search_facts(last_user_msg.content, limit=4)
        if relevant_facts:
            fact_lines = [f"- [{f['category']}] {f['content']}" for f in relevant_facts]
            memory_context = "\n\n### User Long-Term Memory & Stored Preferences:\n" + "\n".join(fact_lines)
    except Exception as e:
        logger.warning(f"Could not retrieve memory context: {e}")

    # Live news/current events context when asking about news or recent events
    news_context = ""
    if needs_live_news(last_user_msg.content):
        news_context = await fetch_news_context(last_user_msg.content)

    # Prepend EDITH System Identity Prompt
    u_title = settings.user.title or "Boss"
    system_prompt = {
        "role": "system",
        "content": (
            "You are EDITH (Even Dead, I'm The Hero), a warm, friendly, intelligent personal AI assistant.\n\n"
            "CONVERSATION & VOICE STYLE:\n"
            "1. Speak like a natural, friendly person—warm, clear, and conversational, never robotic or stiff.\n"
            "2. Address the user naturally as 'Boss' for tasks/actions and 'Sir' only when asking for confirmation.\n"
            "3. Keep replies concise and easy to listen to: summarize key points cleanly instead of dumping raw walls of text.\n"
            "4. For news, current events, or research questions, give a clear, helpful summary based on the latest facts provided.\n"
            + memory_context
            + news_context
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

        # Check for tool intent first
        from edith.core.orchestrator import orchestrator
        from edith.api.websocket import manager as ws_manager

        tool_intent = orchestrator.detect_tool_intent(last_user_msg.content)
        if tool_intent:
            tool_name, params = tool_intent
            action_res = await orchestrator.execute_or_request_authorization(tool_name, params)

            if action_res.get("status") == "completed":
                summary = action_res.get("summary", "Action completed.")
                # Concise operator response: e.g. "Boss, opening VS Code." or "Boss, hardware diagnostic complete."
                tool_output = f"Boss, {summary}"
                yield f"data: {json.dumps({'type': 'token', 'content': tool_output})}\n\n"
                collected_chunks.append(tool_output)

            elif action_res.get("status") == "requires_gui_authorization":
                await ws_manager.broadcast("ACTION_REQUIRED", action_res)
                warn_text = (
                    f"Sir, action `{action_res['tool_name']}` is classified as **DESTRUCTIVE_PRIVILEGED**.\n\n"
                    f"Please review and authorize via the security modal on your screen."
                )
                yield f"data: {json.dumps({'type': 'token', 'content': warn_text})}\n\n"
                collected_chunks.append(warn_text)

            elif action_res.get("status") == "requires_voice_confirmation":
                prompt_text = f"Sir, awaiting voice confirmation: {action_res.get('prompt')}"
                yield f"data: {json.dumps({'type': 'token', 'content': prompt_text})}\n\n"
                collected_chunks.append(prompt_text)

            else:
                err_text = f"Apologies, Boss. Action error: {action_res.get('message', 'Failed to execute')}"
                yield f"data: {json.dumps({'type': 'token', 'content': err_text})}\n\n"
                collected_chunks.append(err_text)

        else:
            # Stream tokens using 3-Tier Fallback: Local Ollama -> Groq -> Gemini
            try:
                async for token in model_manager.generate_stream_with_fallback(
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

            # Trigger background memory extraction & continuous command learning pattern recording
            if last_user_msg.role == "user":
                import asyncio
                asyncio.create_task(memory_extractor.auto_extract_and_persist(last_user_msg.content))
                used_intent = tool_intent[0] if tool_intent else None
                pat_mode = "desktop_tool" if tool_intent else source_mode
                asyncio.create_task(
                    continuous_learner.record_interaction_pattern(
                        prompt=last_user_msg.content,
                        response=full_content,
                        source_mode=pat_mode,
                        model_used=model_name,
                        intent_or_tool=used_intent,
                    )
                )
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

