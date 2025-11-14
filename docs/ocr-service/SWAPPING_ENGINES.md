# Guide: Swapping OCR Engines

This guide shows you exactly how to add and swap between different OCR engines.

## Current State

**Default Engine:** Tesseract (CPU-based, no GPU required)

**Why Tesseract?**
- Widely supported, battle-tested
- Works on any hardware (CPU-only)
- Good for clean text extraction
- Zero external dependencies

**When to swap:**
- Need better accuracy (complex layouts, handwriting)
- Have GPU available (10-20x faster)
- Need multilingual support beyond Latin scripts
- Need table/layout detection

---

## Adding PaddleOCR (Better Accuracy)

### Why PaddleOCR?
- 80+ languages including Chinese, Arabic, Japanese
- Layout detection and table recognition
- Better accuracy than Tesseract on complex documents
- Optional GPU acceleration

### Step 1: Update Dependencies

Edit `pyproject.toml`:

```toml
dependencies = [
    # ... existing dependencies
    "paddleocr==2.7.0",
    "paddlepaddle==2.5.2",  # CPU version
    # Or for GPU:
    # "paddlepaddle-gpu==2.5.2",
]
```

### Step 2: Create Engine Implementation

Create `src/engines/paddle_engine.py`:

```python
"""PaddleOCR engine implementation."""

import io
import asyncio
from functools import partial
from PIL import Image
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes

from .base import OCREngine, OCREngineResult, PageResult


class PaddleOCREngine(OCREngine):
    """PaddleOCR engine with layout detection.
    
    PaddleOCR provides better accuracy than Tesseract, especially for:
    - Complex layouts (multi-column, tables)
    - Multilingual documents (Chinese, Arabic, etc.)
    - Handwritten text (with appropriate models)
    """

    def __init__(self, config: dict):
        super().__init__(config)
        self.lang = config.get("lang", "en")
        self.use_gpu = config.get("use_gpu", False)
        
        # Initialize PaddleOCR
        self.ocr = PaddleOCR(
            use_angle_cls=True,  # Detect text orientation
            lang=self.lang,
            use_gpu=self.use_gpu,
            show_log=False,
        )

    async def process_image(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Process single image with PaddleOCR."""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_image_sync, image_bytes, filename),
        )
        return result

    def _process_image_sync(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Synchronous image processing."""
        image = Image.open(io.BytesIO(image_bytes))
        
        # Run OCR
        result = self.ocr.ocr(image_bytes, cls=True)
        
        # Extract text from result
        # PaddleOCR returns: [[[bbox], (text, confidence)], ...]
        text_lines = []
        if result and result[0]:
            for line in result[0]:
                text_lines.append(line[1][0])  # line[1][0] is the text
        
        text = "\n".join(text_lines)
        
        page = PageResult(
            index=0,
            text=text,
            width=image.width,
            height=image.height,
            dpi=300,
            images=[],
        )
        
        return OCREngineResult(
            pages=[page],
            model_name=self.get_model_name(),
            document_annotation=None,
        )

    async def process_pdf(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Process PDF document with PaddleOCR."""
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_pdf_sync, pdf_bytes, filename),
        )
        return result

    def _process_pdf_sync(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Synchronous PDF processing."""
        images = convert_from_bytes(pdf_bytes, dpi=300)
        
        pages = []
        for idx, image in enumerate(images):
            # Convert PIL Image to bytes
            img_bytes = io.BytesIO()
            image.save(img_bytes, format="PNG")
            img_bytes.seek(0)
            
            # Run OCR
            result = self.ocr.ocr(img_bytes.read(), cls=True)
            
            # Extract text
            text_lines = []
            if result and result[0]:
                for line in result[0]:
                    text_lines.append(line[1][0])
            
            text = "\n".join(text_lines)
            
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

    def supports_gpu(self) -> bool:
        """PaddleOCR supports GPU acceleration."""
        return True

    def get_model_name(self) -> str:
        """Return PaddleOCR identifier."""
        return f"paddleocr-{self.lang}"
```

### Step 3: Register the Engine

Edit `src/engines/registry.py`:

```python
from .tesseract_engine import TesseractEngine
from .paddle_engine import PaddleOCREngine  # Add this

_ENGINE_REGISTRY: Dict[str, Type[OCREngine]] = {
    "tesseract": TesseractEngine,
    "paddleocr": PaddleOCREngine,  # Add this
}
```

Edit `src/engines/__init__.py`:

```python
from .base import OCREngine, OCREngineResult
from .tesseract_engine import TesseractEngine
from .paddle_engine import PaddleOCREngine  # Add this
from .registry import get_engine

__all__ = [
    "OCREngine",
    "OCREngineResult",
    "TesseractEngine",
    "PaddleOCREngine",  # Add this
    "get_engine",
]
```

### Step 4: Add Configuration

Edit `src/config.py`:

```python
# Add PaddleOCR configuration section:

# PaddleOCR Configuration
paddle_lang: str = Field(
    default="en",
    description="PaddleOCR language (en, ch, fr, es, etc.)",
)
paddle_use_angle_cls: bool = Field(
    default=True,
    description="Enable text angle classification",
)
```

### Step 5: Update Dockerfile (Optional, for GPU)

For GPU support, update `Dockerfile`:

```dockerfile
# Use NVIDIA CUDA base image
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Install Python 3.11
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-dev \
    && rm -rf /var/lib/apt/lists/*

# ... rest of Dockerfile
```

### Step 6: Use PaddleOCR

Update `docker-compose.override.yml`:

```yaml
ocr-service:
  environment:
    - OCR_ENGINE=paddleocr  # Change from tesseract
    - OCR_PADDLE_LANG=en
    - OCR_USE_GPU=false  # Set to true if GPU available
```

For GPU:

```yaml
ocr-service:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  environment:
    - OCR_ENGINE=paddleocr
    - OCR_USE_GPU=true
```

### Step 7: Rebuild and Test

```bash
docker-compose build ocr-service
docker-compose up -d ocr-service
curl http://localhost:8000/health
# Should show: "engine": "paddleocr-en"
```

---

## Adding EasyOCR (80+ Languages, GPU)

### Why EasyOCR?
- Supports 80+ languages
- GPU-accelerated (CUDA)
- Good accuracy
- Simple Python API

### Implementation

Create `src/engines/easyocr_engine.py`:

```python
"""EasyOCR engine implementation."""

import io
import asyncio
from functools import partial
from PIL import Image
import easyocr
from pdf2image import convert_from_bytes

from .base import OCREngine, OCREngineResult, PageResult


class EasyOCREngine(OCREngine):
    """EasyOCR engine with GPU acceleration."""

    def __init__(self, config: dict):
        super().__init__(config)
        self.langs = config.get("langs", ["en"])
        self.gpu = config.get("use_gpu", False)
        
        # Initialize EasyOCR reader
        self.reader = easyocr.Reader(
            self.langs,
            gpu=self.gpu,
        )

    async def process_image(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_image_sync, image_bytes, filename),
        )
        return result

    def _process_image_sync(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Run OCR
        # Returns: [[bbox, text, confidence], ...]
        result = self.reader.readtext(image_bytes)
        
        # Extract text
        text_lines = [detection[1] for detection in result]
        text = "\n".join(text_lines)
        
        page = PageResult(
            index=0,
            text=text,
            width=image.width,
            height=image.height,
            dpi=300,
            images=[],
        )
        
        return OCREngineResult(
            pages=[page],
            model_name=self.get_model_name(),
            document_annotation=None,
        )

    async def process_pdf(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(self._process_pdf_sync, pdf_bytes, filename),
        )
        return result

    def _process_pdf_sync(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        images = convert_from_bytes(pdf_bytes, dpi=300)
        
        pages = []
        for idx, image in enumerate(images):
            img_bytes = io.BytesIO()
            image.save(img_bytes, format="PNG")
            img_bytes.seek(0)
            
            result = self.reader.readtext(img_bytes.read())
            text_lines = [detection[1] for detection in result]
            text = "\n".join(text_lines)
            
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

    def supports_gpu(self) -> bool:
        return True

    def get_model_name(self) -> str:
        return f"easyocr-{'-'.join(self.langs)}"
```

Register and use:

```python
# registry.py
_ENGINE_REGISTRY["easyocr"] = EasyOCREngine
```

```yaml
# docker-compose.override.yml
OCR_ENGINE=easyocr
OCR_USE_GPU=true
```

---

## Engine Comparison

| Engine | Accuracy | Speed (CPU) | Speed (GPU) | Languages | Layout Detection | GPU Required |
|--------|----------|-------------|-------------|-----------|-----------------|--------------|
| **Tesseract** | ⭐⭐⭐ | Medium | N/A | 100+ | No | No |
| **PaddleOCR** | ⭐⭐⭐⭐ | Slow | Fast | 80+ | Yes | No (optional) |
| **EasyOCR** | ⭐⭐⭐⭐ | Very Slow | Very Fast | 80+ | No | No (recommended) |
| **Surya** | ⭐⭐⭐⭐⭐ | N/A | Fast | Multi | Yes | Yes |

---

## Switching Between Engines

### At Runtime (Environment Variable)

```bash
# Use Tesseract
docker-compose up -e OCR_ENGINE=tesseract

# Use PaddleOCR
docker-compose up -e OCR_ENGINE=paddleocr

# Use EasyOCR
docker-compose up -e OCR_ENGINE=easyocr
```

### Per Request (Future Enhancement)

Could support engine selection per request:

```json
{
  "model": "paddleocr",  // Override default engine
  "document": { ... }
}
```

Implementation:

```python
@router.post("/ocr")
async def perform_ocr(request: OCRRequest):
    # Get engine from request.model instead of settings
    engine = get_engine(request.model, config)
    result = await engine.process_pdf(...)
```

---

## Configuration Cheat Sheet

### Tesseract

```yaml
OCR_ENGINE=tesseract
OCR_TESSERACT_LANG=eng,fra,deu  # Languages
OCR_TESSERACT_PSM=3             # Page segmentation mode
OCR_TESSERACT_OEM=3             # OCR engine mode
```

### PaddleOCR

```yaml
OCR_ENGINE=paddleocr
OCR_PADDLE_LANG=en              # Language (en, ch, fr, etc.)
OCR_USE_GPU=true                # Enable GPU
```

### EasyOCR

```yaml
OCR_ENGINE=easyocr
OCR_EASYOCR_LANGS=en,fr,de      # Comma-separated languages
OCR_USE_GPU=true                # Enable GPU
```

---

## Troubleshooting

### "Engine not found: paddleocr"

**Cause:** Engine not registered in registry  
**Fix:** Check `src/engines/registry.py` and ensure engine is imported and added to `_ENGINE_REGISTRY`

### "No module named 'paddleocr'"

**Cause:** Dependency not installed  
**Fix:** Add to `pyproject.toml` and rebuild:

```bash
docker-compose build --no-cache ocr-service
```

### GPU Not Detected

**Cause:** Docker doesn't have GPU access  
**Fix:** Ensure NVIDIA Docker runtime is installed:

```bash
# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base nvidia-smi

# Update docker-compose.override.yml with GPU config
```

### Poor Accuracy

**Cause:** Wrong engine for document type  
**Fix:**
- Clean text → Tesseract
- Complex layouts → PaddleOCR
- Multilingual → EasyOCR or PaddleOCR
- Handwriting → PaddleOCR with handwriting model

---

## Best Practices

1. **Start with Tesseract** - Works everywhere, good baseline
2. **Profile before GPU** - Measure CPU speed first, GPU may not be needed
3. **Match engine to document type** - Don't use Tesseract for complex layouts
4. **Test with real documents** - Synthetic tests don't reveal accuracy issues
5. **Monitor resource usage** - GPU engines use more memory
6. **Keep fallback** - If new engine fails, fall back to Tesseract

---

## Next Steps

1. **Benchmark** - Test all engines on your specific documents
2. **Optimize** - Tune PSM/OEM for Tesseract, or lang/cls for PaddleOCR
3. **Scale** - Add load balancing if throughput is insufficient
4. **Monitor** - Add metrics to track accuracy and speed per engine

---

**Ready to swap engines?** Pick one from above, follow the steps, and enjoy better OCR! 🚀

