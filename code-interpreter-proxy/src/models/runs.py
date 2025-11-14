from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


SUPPORTED_LANGUAGES = ["python", "javascript", "java", "cpp", "go", "r"]


class RunRequest(BaseModel):
    session_id: str = Field(..., description="Logical session ID per chat/conversation")
    language: str = Field(..., description="Programming language to execute")
    code: str = Field(..., description="Code to execute")
    args: Optional[List[str]] = Field(None, description="Optional command line arguments")
    timeout_seconds: Optional[int] = Field(
        default=None,
        ge=1,
        le=300,
        description="Timeout in seconds for this run",
    )
    files: Optional[List[str]] = Field(
        default=None,
        description="Optional file IDs to include in run",
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language '{value}' is not supported")
        return value

    @field_validator("files")
    @classmethod
    def validate_files(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        return list(dict.fromkeys(value))


class RunStats(BaseModel):
    cpu_time_seconds: float = Field(..., description="Estimated CPU time used")
    memory_bytes: int = Field(..., description="Memory usage in bytes")
    wall_time_seconds: float = Field(..., description="Wall clock time elapsed")


class RunFileMetadata(BaseModel):
    id: str = Field(..., description="Unique file identifier")
    name: str = Field(..., description="Original filename")
    size_bytes: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="MIME type of the file")
    created_at: Optional[datetime] = Field(None, description="File creation timestamp")
    width: Optional[int] = Field(None, description="Artifact width in pixels")
    height: Optional[int] = Field(None, description="Artifact height in pixels")
    dpi: Optional[int] = Field(None, description="Artifact resolution (DPI)")


class RunResponse(BaseModel):
    run_id: str = Field(..., description="Unique run identifier")
    session_id: str = Field(..., description="Session identifier")
    language: str = Field(..., description="Language used")
    stdout: str = Field(..., description="Standard output")
    stderr: str = Field(..., description="Standard error")
    exit_code: int = Field(..., description="Process exit code")
    stats: RunStats = Field(..., description="Execution statistics")
    files: List[RunFileMetadata] = Field(default_factory=list, description="Output files exposed to caller")
