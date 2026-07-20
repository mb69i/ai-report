"""Atlas Backend – AI Chat API Router"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from loguru import logger

from storage.database import get_session, ChatMessage
from ai.orchestrator import get_orchestrator

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ClearHistoryRequest(BaseModel):
    session_id: str = "default"


@router.post("/chat")
async def chat(req: ChatRequest, session: Session = Depends(get_session)):
    """
    Send a message to the Atlas AI assistant.
    Returns intent classification + natural language response.
    """
    orchestrator = get_orchestrator()

    # Persist user message
    user_msg = ChatMessage(
        session_id=req.session_id,
        role="user",
        content=req.message,
        created_at=datetime.utcnow(),
    )
    session.add(user_msg)
    session.commit()

    try:
        result = await orchestrator.chat(req.message, session_id=req.session_id)

        # Persist assistant response
        assistant_msg = ChatMessage(
            session_id=req.session_id,
            role="assistant",
            content=result.get("response", ""),
            metadata_json=__import__("json").dumps({
                "intent": result.get("intent"),
                "workflow_id": result.get("workflow_id"),
                "confidence": result.get("confidence"),
                "provider": result.get("provider"),
            }),
            created_at=datetime.utcnow(),
        )
        session.add(assistant_msg)
        session.commit()

        return result

    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}")
def get_chat_history(session_id: str, limit: int = 50, session: Session = Depends(get_session)):
    """Get chat message history for a session."""
    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    ).all()
    return messages[-limit:]


@router.delete("/history/{session_id}")
def clear_chat_history(session_id: str, session: Session = Depends(get_session)):
    """Clear chat history for a session."""
    messages = session.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    ).all()
    for msg in messages:
        session.delete(msg)
    session.commit()
    get_orchestrator().clear_history()
    return {"ok": True, "cleared": len(messages)}
