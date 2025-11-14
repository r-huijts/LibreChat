"""Tesseract OCR engine implementation."""

import io
import asyncio
from typing import Optional
from functools import partial
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes

from .base import OCREngine, OCREngineResult, PageResult, ImageResult


class TesseractEngine(OCREngine):
    """Tesseract OCR engine implementation.
    
    Tesseract is a widely-used open-source OCR engine. While not as
    accurate as modern transformer-based models, it's:
    - CPU-only (no GPU needed)
    - Fast for simple documents
    - Battle-tested and stable
    - Good for clean text extraction
    
    Limitations:
    - Struggles with complex layouts (tables, multi-column)
    - Less accurate on handwriting or noisy scans
    - No semantic understanding of document structure
    
    For better accuracy, swap to PaddleOCR or EasyOCR via the registry.
    """

    def __init__(self, config: dict):
        """Initialize Tesseract engine.
        
        Args:
            config: Configuration dict with keys:
                - lang: Language code(s), comma-separated (e.g., "eng,fra")
                - psm: Page segmentation mode (0-13)
                - oem: OCR engine mode (0-3)
        """
        super().__init__(config)
        self.lang = config.get("lang", "eng")
        self.psm = config.get("psm", 3)  # PSM 3: Fully automatic page segmentation
        self.oem = config.get("oem", 3)  # OEM 3: Default, based on what is available

    def _get_tesseract_config(self) -> str:
        """Generate Tesseract configuration string."""
        return f"--psm {self.psm} --oem {self.oem}"

    async def process_image(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Process a single image file.
        
        Runs Tesseract in a thread pool to avoid blocking the event loop.
        """
        # Run OCR in thread pool (pytesseract is CPU-bound)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_image_sync, image_bytes, filename),
        )
        return result

    def _process_image_sync(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Synchronous image processing (runs in thread pool)."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            # Extract text
            text = pytesseract.image_to_string(
                image,
                lang=self.lang,
                config=self._get_tesseract_config(),
            )

            page = PageResult(
                index=0,
                text=text,
                width=image.width,
                height=image.height,
                dpi=300,  # Default assumption
                images=[],
            )

            return OCREngineResult(
                pages=[page],
                model_name=self.get_model_name(),
                document_annotation=None,
            )

        except Exception as e:
            raise RuntimeError(f"Tesseract image processing failed: {str(e)}") from e

    async def process_pdf(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Process a PDF document.
        
        Converts PDF pages to images, then runs Tesseract on each page.
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_pdf_sync, pdf_bytes, filename),
        )
        return result

    def _process_pdf_sync(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Synchronous PDF processing (runs in thread pool)."""
        try:
            # Convert PDF pages to images
            # DPI affects quality vs speed tradeoff
            images = convert_from_bytes(pdf_bytes, dpi=300)

            pages = []
            for idx, image in enumerate(images):
                # Extract text from page
                text = pytesseract.image_to_string(
                    image,
                    lang=self.lang,
                    config=self._get_tesseract_config(),
                )

                page = PageResult(
                    index=idx,
                    text=text,
                    width=image.width,
                    height=image.height,
                    dpi=300,
                    images=[],
                )
                pages.append(page)

            return OCREngineResult(
                pages=pages,
                model_name=self.get_model_name(),
                document_annotation=None,
            )

        except Exception as e:
            raise RuntimeError(f"Tesseract PDF processing failed: {str(e)}") from e

    def supports_gpu(self) -> bool:
        """Tesseract is CPU-only."""
        return False

    def get_model_name(self) -> str:
        """Return Tesseract version info."""
        try:
            version = pytesseract.get_tesseract_version()
            return f"tesseract-{version}"
        except Exception:
            return "tesseract-unknown"


# Future GPU-accelerated engine example:
#
# class EasyOCREngine(OCREngine):
#     """EasyOCR engine with GPU support."""
#
#     def __init__(self, config: dict):
#         super().__init__(config)
#         import easyocr
#         self.gpu = config.get("use_gpu", False)
#         self.reader = easyocr.Reader(
#             config.get("langs", ["en"]),
#             gpu=self.gpu,
#         )
#
#     def supports_gpu(self) -> bool:
#         return True
#
#     async def process_image(...):
#         # Implementation using self.reader
#         pass

