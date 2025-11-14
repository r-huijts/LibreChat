"""OCR engine abstractions and implementations."""

from .base import OCREngine, OCREngineResult
from .tesseract_engine import TesseractEngine
from .registry import get_engine

__all__ = ["OCREngine", "OCREngineResult", "TesseractEngine", "get_engine"]

