"""OCR engine registry and factory."""

from typing import Dict, Type
from .base import OCREngine
from .tesseract_engine import TesseractEngine


# Registry of available engines
_ENGINE_REGISTRY: Dict[str, Type[OCREngine]] = {
    "tesseract": TesseractEngine,
    # Future engines can be registered here:
    # "paddleocr": PaddleOCREngine,
    # "easyocr": EasyOCREngine,
    # "surya": SuryaEngine,
}


def register_engine(name: str, engine_class: Type[OCREngine]):
    """Register a new OCR engine implementation.
    
    This allows plugins or future extensions to add new engines
    without modifying core code.
    
    Args:
        name: Engine identifier (e.g., "paddleocr")
        engine_class: OCREngine subclass
    """
    _ENGINE_REGISTRY[name] = engine_class


def get_engine(engine_name: str, config: dict) -> OCREngine:
    """Factory function to create an OCR engine instance.
    
    Args:
        engine_name: Name of the engine (e.g., "tesseract")
        config: Configuration dict for the engine
        
    Returns:
        Initialized OCREngine instance
        
    Raises:
        ValueError: If engine_name is not registered
    """
    if engine_name not in _ENGINE_REGISTRY:
        available = ", ".join(_ENGINE_REGISTRY.keys())
        raise ValueError(
            f"Unknown OCR engine: {engine_name}. Available engines: {available}"
        )

    engine_class = _ENGINE_REGISTRY[engine_name]
    return engine_class(config)


def list_available_engines() -> list[str]:
    """List all registered OCR engines.
    
    Returns:
        List of engine names
    """
    return list(_ENGINE_REGISTRY.keys())

