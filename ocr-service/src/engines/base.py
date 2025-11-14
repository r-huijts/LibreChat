"""Base OCR engine interface for pluggable implementations."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class OCREngineResult:
    """Result from OCR engine processing.
    
    This is an internal representation that gets converted to the
    Mistral API format by the service layer.
    """

    pages: list["PageResult"]
    model_name: str
    document_annotation: Optional[str] = None


@dataclass
class PageResult:
    """Result for a single page."""

    index: int
    text: str  # Raw extracted text
    width: int
    height: int
    dpi: int = 300
    images: list["ImageResult"] = None

    def __post_init__(self):
        if self.images is None:
            self.images = []


@dataclass
class ImageResult:
    """Extracted image from page."""

    image_id: str
    top_left_x: int = 0
    top_left_y: int = 0
    bottom_right_x: int = 0
    bottom_right_y: int = 0
    image_base64: str = ""
    annotation: Optional[str] = None


class OCREngine(ABC):
    """Abstract base class for OCR engines.
    
    This interface allows swapping between different OCR implementations
    (Tesseract, PaddleOCR, EasyOCR, Surya, etc.) without changing the API layer.
    
    Future implementations can add GPU support, better layout detection,
    or specialized models for handwriting, tables, etc.
    """

    def __init__(self, config: dict):
        """Initialize the OCR engine with configuration.
        
        Args:
            config: Engine-specific configuration dictionary
        """
        self.config = config

    @abstractmethod
    async def process_image(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Process a single image file.
        
        Args:
            image_bytes: Image file content
            filename: Original filename (for format detection)
            
        Returns:
            OCREngineResult containing extracted text and metadata
        """
        pass

    @abstractmethod
    async def process_pdf(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Process a PDF document.
        
        Args:
            pdf_bytes: PDF file content
            filename: Original filename
            
        Returns:
            OCREngineResult with results for each page
        """
        pass

    @abstractmethod
    def supports_gpu(self) -> bool:
        """Check if this engine supports GPU acceleration.
        
        Returns:
            True if GPU support is available
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model/engine name for API responses.
        
        Returns:
            Model identifier string
        """
        pass

    async def cleanup(self):
        """Clean up any resources (GPU memory, temp files, etc.).
        
        Optional hook for engines that need cleanup.
        """
        pass

