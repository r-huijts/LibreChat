"""API route handlers implementing Mistral OCR API contract."""

import time
import uuid
from typing import Annotated
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

from .models import (
    FileUploadResponse,
    OCRRequest,
    OCRResponse,
    OCRPage,
    PageDimensions,
    OCRUsageInfo,
    SignedUrlResponse,
    DeleteResponse,
    HealthResponse,
)
from .engines import OCREngine
from .engines.base import OCREngineResult
from .storage import StorageProvider
from .config import settings


router = APIRouter(prefix="/v1")


# Dependency injection placeholders (set by main.py)
_ocr_engine: OCREngine = None
_storage: StorageProvider = None


def set_dependencies(engine: OCREngine, storage: StorageProvider):
    """Set global dependencies for route handlers."""
    global _ocr_engine, _storage
    _ocr_engine = engine
    _storage = storage


def _convert_to_api_format(
    result: OCREngineResult, file_size: int
) -> OCRResponse:
    """Convert internal OCREngineResult to Mistral API format."""
    pages = []
    for page in result.pages:
        api_page = OCRPage(
            index=page.index,
            markdown=page.text,
            images=[],  # Image extraction not implemented yet
            dimensions=PageDimensions(
                dpi=page.dpi,
                height=page.height,
                width=page.width,
            ),
        )
        pages.append(api_page)

    return OCRResponse(
        pages=pages,
        model=result.model_name,
        document_annotation=result.document_annotation,
        usage_info=OCRUsageInfo(
            pages_processed=len(pages),
            doc_size_bytes=file_size,
        ),
    )


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    purpose: Annotated[str, Form()] = "ocr",
):
    """Upload a file for OCR processing.
    
    This endpoint accepts document uploads and stores them for processing.
    Compatible with Mistral's file upload API.
    """
    if purpose != "ocr":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'ocr' purpose is supported",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.max_file_size_mb}MB limit",
        )

    # Generate unique file ID
    file_id = str(uuid.uuid4())

    # Store file
    stored_file = await _storage.save_file(
        file_id=file_id,
        filename=file.filename or "document",
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )

    return FileUploadResponse(
        id=stored_file.file_id,
        object="file",
        bytes=stored_file.size_bytes,
        created_at=stored_file.created_at,
        filename=stored_file.filename,
        purpose=purpose,
    )


@router.post("/ocr", response_model=OCRResponse)
async def perform_ocr(request: OCRRequest):
    """Perform OCR on an uploaded document.
    
    Extracts text from the document and returns structured results.
    Compatible with Mistral's OCR API.
    """
    # Extract file ID from document URL
    doc = request.document
    if doc.type == "document_url" and doc.document_url:
        file_ref = doc.document_url
    elif doc.type == "image_url" and doc.image_url:
        file_ref = doc.image_url
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either document_url or image_url must be provided",
        )

    # Extract file ID (handle both direct IDs and URLs)
    # Handle URLs like: /files/{file_id}/download or /files/{file_id}
    parts = file_ref.rstrip("/").split("/")
    if parts[-1] == "download":
        file_id = parts[-2]
    else:
        file_id = parts[-1]

    # Retrieve file from storage
    file_data = await _storage.get_file(file_id)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_id}",
        )

    content, metadata = file_data

    # Determine file type and process accordingly
    filename = metadata.filename.lower()
    try:
        if filename.endswith(".pdf"):
            result = await _ocr_engine.process_pdf(content, metadata.filename)
        elif any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]):
            result = await _ocr_engine.process_image(content, metadata.filename)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {filename}",
            )

        # Convert to API format
        return _convert_to_api_format(result, metadata.size_bytes)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}",
        ) from e


@router.get("/files/{file_id}/url", response_model=SignedUrlResponse)
async def get_file_url(file_id: str, expiry: int = 24):
    """Get a URL for accessing an uploaded file.
    
    Returns a URL that can be used to download the file.
    Compatible with Mistral's file URL API.
    """
    url = await _storage.get_file_url(file_id, expiry_hours=expiry)
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_id}",
        )

    expires_at = int(time.time()) + (expiry * 3600)
    return SignedUrlResponse(url=url, expires_at=expires_at)


@router.delete("/files/{file_id}", response_model=DeleteResponse)
async def delete_file(file_id: str):
    """Delete an uploaded file.
    
    Removes the file from storage. Compatible with Mistral's file deletion API.
    """
    deleted = await _storage.delete_file(file_id)
    return DeleteResponse(deleted=deleted)


@router.get("/files/{file_id}/download")
async def download_file(file_id: str):
    """Download file content (internal endpoint for memory/local storage)."""
    file_data = await _storage.get_file(file_id)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_id}",
        )

    content, metadata = file_data
    from fastapi.responses import Response

    return Response(
        content=content,
        media_type=metadata.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{metadata.filename}"',
        },
    )


# Health check endpoint (outside /v1 prefix)
health_router = APIRouter()


@health_router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        engine=_ocr_engine.get_model_name() if _ocr_engine else "unknown",
        gpu_available=_ocr_engine.supports_gpu() if _ocr_engine else False,
    )

