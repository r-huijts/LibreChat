import logging
import mimetypes
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from models.files import FileDeleteResponse, FileListResponse, FileMetadata, FileUploadResponse
from utils.auth import require_api_key
from utils.storage import file_storage

router = APIRouter(prefix="/files", tags=["files"])

logger = logging.getLogger(__name__)


def _to_metadata(session_id: str, raw: dict) -> FileMetadata:
    return FileMetadata(
        id=raw["id"],
        session_id=session_id,
        name=raw["filename"],
        size_bytes=raw["size"],
        mime_type=raw["content_type"],
        created_at=raw["created_at"],
    )


@router.post("", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    session_id: str = Form(..., description="Target session identifier"),
    file: UploadFile = File(...),
    _: str = Depends(require_api_key),
) -> FileUploadResponse:
    try:
        contents = await file.read()
        metadata = await file_storage.save_file(session_id, file.filename, contents)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error saving uploaded file")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="File upload failed") from exc

    return FileUploadResponse(file=_to_metadata(session_id, metadata))


@router.get("", response_model=FileListResponse)
async def list_files(
    session_id: str = Query(..., description="Session identifier"),
    _: str = Depends(require_api_key),
) -> FileListResponse:
    listing = await file_storage.list_files(session_id)
    files: List[FileMetadata] = [
        _to_metadata(session_id, raw) for raw in listing.get("files", [])
    ]
    return FileListResponse(session_id=session_id, files=files, total=listing.get("total", 0))


@router.get("/{file_id}")
async def download_file(
    file_id: str,
    _: str = Depends(require_api_key),
) -> FileResponse:
    located = await file_storage.find_file(file_id)
    if not located:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    session_id, file_path = located
    mime_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(
        path=file_path,
        media_type=mime_type or "application/octet-stream",
        filename=file_path.name,
        headers={"x-session-id": session_id},
    )


@router.delete("/{file_id}", response_model=FileDeleteResponse)
async def delete_file(
    file_id: str,
    _: str = Depends(require_api_key),
) -> FileDeleteResponse:
    located = await file_storage.find_file(file_id)
    if not located:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    session_id, _ = located
    success = await file_storage.delete_file(session_id, file_id)
    message = "File deleted" if success else "Failed to delete file"
    return FileDeleteResponse(success=success, message=message)
