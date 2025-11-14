from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class FileMetadata(BaseModel):
    id: str = Field(..., description="Unique file identifier")
    session_id: str = Field(..., description="Associated session identifier")
    name: str = Field(..., description="Filename visible to the user")
    size_bytes: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="MIME type of the file")
    created_at: datetime = Field(..., description="Upload timestamp in UTC")


class FileUploadResponse(BaseModel):
    file: FileMetadata = Field(..., description="Uploaded file metadata")


class FileListResponse(BaseModel):
    session_id: str = Field(..., description="Requested session id")
    files: List[FileMetadata] = Field(default_factory=list, description="List of files for the session")
    total: int = Field(..., description="Total number of files")


class FileDeleteResponse(BaseModel):
    success: bool = Field(..., description="Whether deletion was successful")
    message: str = Field(..., description="Status message")
