"""Pydantic models matching Mistral OCR API contract."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class FileUploadResponse(BaseModel):
    """Response for file upload endpoint."""

    id: str = Field(..., description="Unique file identifier")
    object: str = Field(default="file", description="Object type")
    bytes: int = Field(..., description="File size in bytes")
    created_at: int = Field(..., description="Unix timestamp of creation")
    filename: str = Field(..., description="Original filename")
    purpose: str = Field(default="ocr", description="File purpose")


class PageDimensions(BaseModel):
    """Page dimensions metadata."""

    dpi: int = Field(default=300, description="Dots per inch")
    height: int = Field(..., description="Page height in pixels")
    width: int = Field(..., description="Page width in pixels")


class OCRImage(BaseModel):
    """Extracted image metadata from OCR."""

    id: str = Field(..., description="Image identifier")
    top_left_x: int = Field(default=0, description="Top-left X coordinate")
    top_left_y: int = Field(default=0, description="Top-left Y coordinate")
    bottom_right_x: int = Field(default=0, description="Bottom-right X coordinate")
    bottom_right_y: int = Field(default=0, description="Bottom-right Y coordinate")
    image_base64: str = Field(default="", description="Base64-encoded image")
    image_annotation: Optional[str] = Field(None, description="Image annotation/caption")


class OCRPage(BaseModel):
    """OCR result for a single page."""

    index: int = Field(..., description="Page index (0-based)")
    markdown: str = Field(..., description="Extracted text in markdown format")
    images: list[OCRImage] = Field(default_factory=list, description="Extracted images")
    dimensions: PageDimensions = Field(..., description="Page dimensions")


class OCRUsageInfo(BaseModel):
    """Usage information for OCR processing."""

    pages_processed: int = Field(..., description="Number of pages processed")
    doc_size_bytes: int = Field(..., description="Document size in bytes")


class OCRResponse(BaseModel):
    """Response for OCR processing endpoint."""

    pages: list[OCRPage] = Field(..., description="OCR results per page")
    model: str = Field(..., description="Model/engine used for OCR")
    document_annotation: Optional[str] = Field(None, description="Document-level annotation")
    usage_info: OCRUsageInfo = Field(..., description="Usage statistics")


class DocumentReference(BaseModel):
    """Document reference in OCR request."""

    type: Literal["document_url", "image_url"] = Field(
        ..., description="Type of document reference"
    )
    document_url: Optional[str] = Field(None, description="URL to document")
    image_url: Optional[str] = Field(None, description="URL to image")


class OCRRequest(BaseModel):
    """Request body for OCR processing."""

    model: str = Field(default="tesseract", description="OCR model to use")
    image_limit: int = Field(default=0, description="Limit number of images to extract")
    include_image_base64: bool = Field(
        default=False, description="Include base64-encoded images"
    )
    document: DocumentReference = Field(..., description="Document to process")


class SignedUrlResponse(BaseModel):
    """Response for signed URL endpoint."""

    url: str = Field(..., description="Signed URL for file access")
    expires_at: int = Field(..., description="Unix timestamp of URL expiration")


class DeleteResponse(BaseModel):
    """Response for file deletion."""

    deleted: bool = Field(default=True, description="Whether file was deleted")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(default="ok", description="Service status")
    engine: str = Field(..., description="Current OCR engine")
    gpu_available: bool = Field(default=False, description="GPU availability")

