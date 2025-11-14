import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from models.runs import RunRequest
from sandbox import session_manager
from utils.auth import require_api_key
from utils.storage import file_storage

router = APIRouter(tags=["compat"])

LANGUAGE_ALIAS_MAP = {
    "py": "python",
    "python": "python",
    "js": "javascript",
    "javascript": "javascript",
    "ts": "javascript",
    "typescript": "javascript",
    "cpp": "cpp",
    "c++": "cpp",
    "c": "cpp",
    "go": "go",
    "golang": "go",
    "java": "java",
    "r": "r",
}


class ExecFileReference(BaseModel):
    id: str = Field(..., description="Unique identifier of the file within a session")
    session_id: Optional[str] = Field(
        None, description="Session identifier the file belongs to"
    )
    name: Optional[str] = Field(
        None, description="Human friendly file name (ignored for lookup)"
    )


class ExecRequest(BaseModel):
    lang: str = Field(..., description="Runtime shorthand language identifier (e.g. py)")
    code: str = Field(..., description="Code to execute")
    args: Optional[List[str]] = Field(
        default=None, description="Optional command line arguments"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Existing session id to reuse. New session created if omitted.",
    )
    timeout: Optional[int] = Field(
        default=None, description="Optional timeout override in seconds"
    )
    files: Optional[List[ExecFileReference]] = Field(
        default=None, description="Optional list of file references to include"
    )


def _resolve_language(lang: str) -> str:
    mapped = LANGUAGE_ALIAS_MAP.get(lang.lower())
    if mapped:
        return mapped
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Language '{lang}' is not supported by the sandbox",
    )


async def _resolve_exec_files(
    session_id: str, files: Optional[List[ExecFileReference]]
) -> List[dict]:
    if not files:
        return []

    records: List[dict] = []
    for file_ref in files:
        source_session = file_ref.session_id or session_id
        metadata = await file_storage.get_file_metadata(source_session, file_ref.id)
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File '{file_ref.id}' not found for session '{source_session}'",
            )
        records.append(
            {
                "id": file_ref.id,
                "session_id": source_session,
                "filename": metadata["filename"],
                "path": metadata["path"],
            }
        )
    return records


def _format_exec_files(session_id: str, files: List) -> List[dict]:
    """
    Format files for LibreChat's execute_code tool.
    The backend expects: { id, name, session_id } where:
    - id: file identifier for download path construction
    - name: original filename
    - session_id: session identifier
    """
    formatted: List[dict] = []
    for file in files:
        entry = {
            "id": file.id,
            "name": file.name,
            "session_id": session_id,
        }
        # Add dimension metadata for images
        if file.width is not None:
            entry["width"] = file.width
        if file.height is not None:
            entry["height"] = file.height
        if file.dpi is not None:
            entry["dpi"] = file.dpi
        formatted.append(entry)
    return formatted


@router.post("/exec")
async def execute_compat(
    payload: ExecRequest, _: str = Depends(require_api_key)
) -> dict:
    session_id = payload.session_id or str(uuid.uuid4())
    language = _resolve_language(payload.lang)
    file_records = await _resolve_exec_files(session_id, payload.files)

    run_payload = RunRequest(
        session_id=session_id,
        language=language,
        code=payload.code,
        args=payload.args,
        timeout_seconds=payload.timeout,
        files=[record["id"] for record in file_records] or None,
    )

    try:
        result = await session_manager.run_code(run_payload, file_records)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {exc}",
        ) from exc

    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
        "session_id": session_id,
        "files": _format_exec_files(session_id, result.files),
    }


@router.get("/files/{session_id}")
async def list_session_files(
    session_id: str,
    _: str = Depends(require_api_key),
    _detail: Optional[str] = Query(
        default=None, description="Retention for compatibility (ignored)"
    ),
) -> List[dict]:
    """
    List files for a session.
    The backend's getSessionInfo() expects files with:
    - name: in format "{session_id}/{file_id}" for matching
    - lastModified: timestamp string
    """
    listing = await file_storage.list_files(session_id)
    response: List[dict] = []
    for file in listing.get("files", []):
        # Format name as session_id/file_id for backend matching
        name_component = f"{session_id}/{file['id']}"
        entry = {
            "name": name_component,
            "size": file["size"],
            "lastModified": file.get("created_at", "").isoformat() if file.get("created_at") else None,
        }
        response.append(entry)
    return response


@router.get("/download/{session_id}/{file_id}")
async def download_file(
    session_id: str,
    file_id: str,
    _: str = Depends(require_api_key),
):
    """
    Download a file by session and file ID.
    The backend constructs paths as /download/{session_id}/{id} where id is the file_id.
    """
    file_path = await file_storage.get_file(session_id, file_id)
    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream"
    )

