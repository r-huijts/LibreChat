# OCR Service

A modular, pluggable OCR microservice implementing Mistral's OCR API contract for LibreChat.

## Features

- ✅ **Pluggable OCR engines** - Easily swap between Tesseract, PaddleOCR, EasyOCR, etc.
- ✅ **Multiple storage backends** - Memory, local disk, S3 (extensible)
- ✅ **GPU-ready architecture** - GPU support hooks for future engines
- ✅ **Mistral API compatible** - Drop-in replacement for Mistral OCR
- ✅ **Docker-first design** - Production-ready containerization
- ✅ **Type-safe** - Full Pydantic models and type hints
- ✅ **Async by default** - Non-blocking I/O for better throughput

## Architecture

```
┌─────────────────┐
│   LibreChat     │
└────────┬────────┘
         │ HTTP (Mistral API contract)
         ↓
┌─────────────────┐
│  FastAPI Routes │  ← API contract layer
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌──────────┐
│ Storage │ │  Engine  │  ← Pluggable implementations
│Provider │ │ Registry │
└─────────┘ └────┬─────┘
                 │
       ┌─────────┼─────────┐
       ↓         ↓         ↓
  ┌──────────┐ ┌────────┐ ┌────────┐
  │Tesseract │ │Paddle  │ │EasyOCR │  ← Swap engines here
  └──────────┘ └────────┘ └────────┘
```

### Key Design Principles

1. **Loose Coupling**: OCR engines implement a common interface (`OCREngine`)
2. **Dependency Injection**: Storage and engine are injected at startup
3. **Single Responsibility**: Each layer has one job (API, storage, OCR)
4. **Open/Closed**: New engines/storage can be added without modifying existing code

## Quick Start

### Docker Deployment (Recommended)

1. **Add to your `docker-compose.override.yml`:**

```yaml
services:
  api:
    depends_on:
      - ocr-service

  ocr-service:
    build:
      context: ./ocr-service
      dockerfile: Dockerfile
    container_name: ocr-service
    environment:
      - OCR_API_KEY=${OCR_API_KEY:-dev-ocr-key}
      - OCR_ENGINE=tesseract
      - OCR_STORAGE_BACKEND=memory
      - OCR_LOG_LEVEL=INFO
    volumes:
      - ocr_files:/data/ocr
    restart: unless-stopped
    # No need to expose ports - internal Docker network only

volumes:
  ocr_files:
```

2. **Configure LibreChat (`librechat.yaml`):**

```yaml
ocr:
  apiKey: "${OCR_API_KEY}"
  baseURL: "http://ocr-service:8000/v1"
  strategy: "custom_ocr"
```

3. **Set environment variable (`.env`):**

```bash
OCR_API_KEY=your-secret-key-here
```

4. **Start the service:**

```bash
docker-compose up -d ocr-service
```

### Local Development

```bash
cd ocr-service

# Install dependencies
pip install -e .

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install tesseract-ocr libtesseract-dev poppler-utils

# Run the service
uvicorn src.main:app --reload --port 8000
```

## Configuration

All configuration is done via environment variables with the `OCR_` prefix.

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_API_KEY` | `dev-ocr-key` | API key for authentication |
| `OCR_ENGINE` | `tesseract` | OCR engine to use |
| `OCR_STORAGE_BACKEND` | `memory` | Storage backend (memory/local/s3) |

### Tesseract Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_TESSERACT_LANG` | `eng` | Language codes (comma-separated) |
| `OCR_TESSERACT_PSM` | `3` | Page segmentation mode (0-13) |
| `OCR_TESSERACT_OEM` | `3` | OCR engine mode (0-3) |

### GPU Configuration (Future Use)

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_USE_GPU` | `false` | Enable GPU acceleration |
| `OCR_GPU_DEVICE_ID` | `0` | GPU device ID |

See `.env.example` for full configuration options.

## Adding a New OCR Engine

The service is designed for easy engine swapping. Here's how to add a new engine:

### 1. Create Engine Implementation

Create `src/engines/your_engine.py`:

```python
from .base import OCREngine, OCREngineResult, PageResult

class YourEngine(OCREngine):
    """Your custom OCR engine."""
    
    def __init__(self, config: dict):
        super().__init__(config)
        # Initialize your engine
        # e.g., self.model = load_model(config.get("model_path"))
    
    async def process_image(self, image_bytes: bytes, filename: str) -> OCREngineResult:
        """Process single image."""
        # Your implementation
        text = your_ocr_function(image_bytes)
        
        page = PageResult(
            index=0,
            text=text,
            width=image.width,
            height=image.height,
        )
        
        return OCREngineResult(
            pages=[page],
            model_name="your-engine-v1",
        )
    
    async def process_pdf(self, pdf_bytes: bytes, filename: str) -> OCREngineResult:
        """Process PDF document."""
        # Your implementation
        pass
    
    def supports_gpu(self) -> bool:
        return True  # If your engine supports GPU
    
    def get_model_name(self) -> str:
        return "your-engine-v1"
```

### 2. Register the Engine

In `src/engines/registry.py`:

```python
from .your_engine import YourEngine

_ENGINE_REGISTRY = {
    "tesseract": TesseractEngine,
    "yourengine": YourEngine,  # Add your engine
}
```

### 3. Use the Engine

Set environment variable:

```bash
OCR_ENGINE=yourengine
```

That's it! No changes to API routes, storage, or other layers.

## Adding GPU Support

### Example: EasyOCR with GPU

1. **Update `Dockerfile`** to include CUDA:

```dockerfile
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Install Python 3.11
RUN apt-get update && apt-get install -y python3.11 python3-pip

# ... rest of Dockerfile
```

2. **Add dependencies** to `pyproject.toml`:

```toml
dependencies = [
    # ... existing deps
    "easyocr==1.7.0",
    "torch>=2.0.0",
]
```

3. **Implement engine** (`src/engines/easyocr_engine.py`):

```python
import easyocr

class EasyOCREngine(OCREngine):
    def __init__(self, config: dict):
        super().__init__(config)
        self.gpu = config.get("use_gpu", False)
        self.reader = easyocr.Reader(
            lang_list=config.get("langs", ["en"]),
            gpu=self.gpu,
        )
    
    async def process_image(self, image_bytes: bytes, filename: str):
        # Run EasyOCR
        result = self.reader.readtext(image_bytes)
        text = "\n".join([detection[1] for detection in result])
        # ... return OCREngineResult
    
    def supports_gpu(self) -> bool:
        return True
```

4. **Update `docker-compose.override.yml`**:

```yaml
ocr-service:
  # ... existing config
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  environment:
    - OCR_ENGINE=easyocr
    - OCR_USE_GPU=true
```

## API Endpoints

The service implements Mistral's OCR API contract:

### POST `/v1/files`
Upload a file for OCR processing.

**Request:**
```bash
curl -X POST http://localhost:8000/v1/files \
  -H "Authorization: Bearer your-api-key" \
  -F "file=@document.pdf" \
  -F "purpose=ocr"
```

**Response:**
```json
{
  "id": "file-abc123",
  "object": "file",
  "bytes": 1234567,
  "created_at": 1234567890,
  "filename": "document.pdf",
  "purpose": "ocr"
}
```

### POST `/v1/ocr`
Perform OCR on an uploaded document.

**Request:**
```bash
curl -X POST http://localhost:8000/v1/ocr \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tesseract",
    "document": {
      "type": "document_url",
      "document_url": "file-abc123"
    }
  }'
```

**Response:**
```json
{
  "pages": [
    {
      "index": 0,
      "markdown": "Extracted text here...",
      "images": [],
      "dimensions": {"dpi": 300, "height": 1200, "width": 800}
    }
  ],
  "model": "tesseract-5.3.0",
  "usage_info": {
    "pages_processed": 1,
    "doc_size_bytes": 1234567
  }
}
```

### GET `/v1/files/{file_id}/url`
Get a URL for accessing the file.

### DELETE `/v1/files/{file_id}`
Delete a file from storage.

### GET `/health`
Health check endpoint (no auth required).

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "engine": "tesseract-5.3.0",
  "gpu_available": false
}
```

## Storage Backends

### Memory Storage (Default)
- Files stored in RAM
- Fast, simple
- Lost on restart
- Suitable for: Development, testing

### Local Storage (Future)
- Files stored on disk
- Persistent across restarts
- Requires volume mount
- Suitable for: Single-server deployments

### S3 Storage (Future)
- Files stored in AWS S3
- Scalable, durable
- Requires AWS credentials
- Suitable for: Production, multi-instance deployments

To implement a new storage backend, extend `StorageProvider` in `src/storage/base.py`.

## Testing

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# With coverage
pytest --cov=src --cov-report=html
```

## Troubleshooting

### Tesseract Not Found

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr libtesseract-dev

# macOS
brew install tesseract

# Check installation
tesseract --version
```

### Poor OCR Quality

1. **Try different PSM modes**:
   - `OCR_TESSERACT_PSM=6` for single uniform block of text
   - `OCR_TESSERACT_PSM=11` for sparse text

2. **Add language packs**:
   ```bash
   # In Dockerfile
   RUN apt-get install tesseract-ocr-fra tesseract-ocr-deu
   ```

3. **Consider switching engines**:
   - PaddleOCR for better multilingual support
   - EasyOCR for GPU acceleration
   - Surya for layout-aware extraction

### File Upload Fails

Check file size limits:
```bash
OCR_MAX_FILE_SIZE_MB=20  # Increase limit
```

### GPU Not Detected

Ensure Docker has GPU access:
```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base nvidia-smi
```

## Performance

### Tesseract (CPU)
- Simple document (1 page): ~1-2 seconds
- Complex PDF (10 pages): ~10-20 seconds
- Memory: ~200MB base + ~50MB per concurrent request

### EasyOCR (GPU)
- Simple document: ~0.5-1 second
- Complex PDF (10 pages): ~2-5 seconds
- Memory: ~2GB GPU RAM + ~500MB system RAM

## Roadmap

- [ ] Local disk storage provider
- [ ] S3 storage provider
- [ ] PaddleOCR engine implementation
- [ ] EasyOCR engine implementation
- [ ] Surya engine implementation
- [ ] Layout detection and table extraction
- [ ] Image extraction from documents
- [ ] Batch processing API
- [ ] Prometheus metrics
- [ ] Rate limiting per user

## Contributing

To add a new feature:

1. Implement the interface (engine, storage, etc.)
2. Register it in the appropriate registry
3. Add configuration options to `config.py`
4. Update this README
5. Add tests

## License

See parent LibreChat repository.

## Support

For issues related to:
- **This service**: Open an issue in the LibreChat repository
- **Tesseract**: See [tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract)
- **PaddleOCR**: See [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
- **EasyOCR**: See [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR)

