from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class SessionCreateResponse(BaseModel):
    id: str = Field(..., description="Unique session identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    expires_at: datetime = Field(..., description="Session expiration time")


class SessionStatus(BaseModel):
    id: str = Field(..., description="Session identifier")
    active: bool = Field(..., description="Whether session is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    expires_at: datetime = Field(..., description="Expiration time")
    last_activity: datetime = Field(..., description="Last activity timestamp")
    file_count: int = Field(..., description="Number of files in session")
