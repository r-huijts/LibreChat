import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from sandbox import session_manager
from utils.auth import require_api_key

router = APIRouter(prefix="/sessions", tags=["sessions"])

logger = logging.getLogger(__name__)


class SessionInfo(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    language: str = Field(..., description="Programming language")
    created_at: datetime = Field(..., description="Session creation timestamp")
    last_activity: datetime = Field(..., description="Last activity timestamp")
    age_minutes: float = Field(..., description="Age in minutes")
    is_expired: bool = Field(..., description="Whether the session is expired")


class SessionListResponse(BaseModel):
    sessions: List[SessionInfo] = Field(default_factory=list, description="Active sessions")
    total: int = Field(..., description="Total number of active sessions")


class SessionDeleteResponse(BaseModel):
    success: bool = Field(..., description="Whether the session was deleted")
    message: str = Field(..., description="Status message")


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    _: str = Depends(require_api_key),
) -> SessionListResponse:
    """
    List all active sessions with their status and age.
    Useful for debugging and monitoring.
    """
    sessions: List[SessionInfo] = []
    now = datetime.utcnow()
    
    async with session_manager._lock:
        for session_id, wrapper in session_manager._sessions.items():
            age_minutes = (now - wrapper.created_at).total_seconds() / 60
            sessions.append(
                SessionInfo(
                    session_id=session_id,
                    language=wrapper.language,
                    created_at=wrapper.created_at,
                    last_activity=wrapper.last_activity,
                    age_minutes=age_minutes,
                    is_expired=wrapper.is_expired(),
                )
            )
    
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.delete("/{session_id}", response_model=SessionDeleteResponse)
async def delete_session(
    session_id: str,
    _: str = Depends(require_api_key),
) -> SessionDeleteResponse:
    """
    Delete a session and its associated sandbox container.
    This will close the llm-sandbox container and remove all session files.
    """
    success = await session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found or already deleted",
        )

    return SessionDeleteResponse(
        success=True,
        message=f"Session '{session_id}' deleted successfully",
    )

