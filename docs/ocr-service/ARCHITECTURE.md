# OCR Service Architecture

## Design Philosophy

This service is built with **modularity** and **extensibility** as core principles. Every layer is abstracted behind interfaces, allowing you to swap implementations without touching unrelated code.

## Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Application                    │
│                      (src/main.py)                        │
└───────────────────────┬──────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Middleware   │ │  API Routes  │ │   Config     │
│  (Auth)      │ │ (routes.py)  │ │ (config.py)  │
└──────────────┘ └──────┬───────┘ └──────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ↓                               ↓
┌──────────────────┐           ┌──────────────────┐
│ Storage Registry │           │  Engine Registry │
│  (pluggable)     │           │   (pluggable)    │
└────────┬─────────┘           └─────────┬────────┘
         │                               │
    ┌────┴────┐                     ┌────┴────┐
    ↓         ↓                     ↓         ↓
┌────────┐ ┌────┐              ┌───────────┐ ┌─────────┐
│Memory  │ │ S3 │              │Tesseract  │ │Paddle   │
└────────┘ └────┘              └───────────┘ └─────────┘
```

## Core Abstractions

### 1. OCREngine Interface

**Location:** `src/engines/base.py`

```python
class OCREngine(ABC):
    async def process_image(bytes, filename) -> OCREngineResult
    async def process_pdf(bytes, filename) -> OCREngineResult
    def supports_gpu() -> bool
    def get_model_name() -> str
```

**Why:** Allows swapping OCR implementations (Tesseract → PaddleOCR → EasyOCR) without changing the API layer.

**Current Implementations:**
- `TesseractEngine` (CPU-based, simple, good for clean text)

**Future Implementations:**
- `PaddleOCREngine` (better multilingual, layout detection)
- `EasyOCREngine` (GPU-accelerated, 80+ languages)
- `SuryaEngine` (modern transformer, layout-aware)

### 2. StorageProvider Interface

**Location:** `src/storage/base.py`

```python
class StorageProvider(ABC):
    async def save_file(id, filename, content, type) -> StoredFile
    async def get_file(id) -> tuple[bytes, StoredFile]
    async def delete_file(id) -> bool
    async def get_file_url(id, expiry) -> str
```

**Why:** Decouples file storage from OCR processing. Switch between memory/disk/S3 without API changes.

**Current Implementations:**
- `MemoryStorage` (fast, simple, non-persistent)

**Future Implementations:**
- `LocalStorage` (disk-based, persistent)
- `S3Storage` (cloud, scalable, durable)

### 3. Registry Pattern

**Locations:** 
- `src/engines/registry.py`
- `src/storage/registry.py`

```python
_ENGINE_REGISTRY = {
    "tesseract": TesseractEngine,
    "paddleocr": PaddleOCREngine,  # Future
}

def get_engine(name: str, config: dict) -> OCREngine:
    return _ENGINE_REGISTRY[name](config)
```

**Why:** 
- Centralized registration of implementations
- Easy to add new engines without modifying core code
- Allows plugin-style extensibility

## Data Flow

### File Upload → OCR → Response

```
1. Client uploads PDF
   ↓
2. POST /v1/files
   ↓
3. AuthMiddleware validates API key
   ↓
4. routes.upload_file() called
   ↓
5. StorageProvider.save_file()
   ├─ MemoryStorage: stores in RAM
   ├─ LocalStorage: saves to disk (future)
   └─ S3Storage: uploads to S3 (future)
   ↓
6. Returns file_id
   ↓
7. Client requests OCR
   ↓
8. POST /v1/ocr with file_id
   ↓
9. routes.perform_ocr() retrieves file
   ↓
10. Determines file type (PDF/image)
    ↓
11. Calls OCREngine.process_pdf() or process_image()
    ├─ TesseractEngine: runs Tesseract in thread pool
    ├─ PaddleOCREngine: runs Paddle inference (future)
    └─ EasyOCREngine: runs on GPU (future)
    ↓
12. OCREngineResult returned (internal format)
    ↓
13. Convert to Mistral API format (OCRResponse)
    ↓
14. Return JSON to client
```

## Configuration Flow

```
Environment Variables (OCR_*)
   ↓
pydantic-settings parses
   ↓
Settings object (src/config.py)
   ↓
Passed to factories at startup
   ↓
get_engine(settings.engine, {...})
get_storage_provider(settings.storage_backend, {...})
   ↓
Instances injected into route handlers
```

## Dependency Injection

Dependencies are set once at startup and reused across requests:

```python
# In src/main.py lifespan():
ocr_engine = get_engine(settings.engine, config)
storage = get_storage_provider(settings.storage_backend, config)

# Inject into routes
set_dependencies(ocr_engine, storage)

# Routes use global references (set once, read many times)
_ocr_engine.process_pdf(...)
_storage.save_file(...)
```

**Why not FastAPI dependencies?**
- Engines are expensive to initialize (loading models)
- Should be singletons, not created per-request
- Global state is acceptable here (read-only after startup)

## Thread Safety

- **OCREngine**: Stateless after initialization. Thread-safe.
- **StorageProvider**: Uses asyncio primitives. Async-safe.
- **Routes**: Async handlers with proper locking where needed.

**Tesseract note:** Runs in thread pool (`run_in_executor`) because it's CPU-bound and blocking.

## Adding New Components

### Adding a New Engine

1. **Create implementation:**
   ```python
   # src/engines/paddle_engine.py
   class PaddleOCREngine(OCREngine):
       # Implement abstract methods
   ```

2. **Register it:**
   ```python
   # src/engines/registry.py
   from .paddle_engine import PaddleOCREngine
   
   _ENGINE_REGISTRY["paddleocr"] = PaddleOCREngine
   ```

3. **Add config options:**
   ```python
   # src/config.py
   paddle_det_model: str = Field(...)
   ```

4. **Use it:**
   ```bash
   OCR_ENGINE=paddleocr
   ```

### Adding a New Storage Provider

Same pattern as engines:

1. Implement `StorageProvider`
2. Register in `storage/registry.py`
3. Add config to `config.py`
4. Set `OCR_STORAGE_BACKEND`

### Adding Middleware

```python
# src/middleware/rate_limit.py
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Rate limiting logic
        return await call_next(request)

# src/main.py
app.add_middleware(RateLimitMiddleware, ...)
```

## GPU Support Strategy

The architecture is GPU-ready:

1. **Engine level:**
   ```python
   class EasyOCREngine(OCREngine):
       def __init__(self, config):
           self.gpu = config["use_gpu"]
           self.reader = easyocr.Reader(gpu=self.gpu)
       
       def supports_gpu(self) -> bool:
           return True
   ```

2. **Config level:**
   ```python
   OCR_USE_GPU=true
   OCR_GPU_DEVICE_ID=0
   ```

3. **Docker level:**
   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             capabilities: [gpu]
   ```

## Error Handling

- **Storage errors:** HTTP 404 if file not found, 500 for storage failures
- **OCR errors:** HTTP 500 with detailed message (logged server-side)
- **Auth errors:** HTTP 401 if API key invalid
- **Validation errors:** HTTP 400 with Pydantic details

## Testing Strategy

### Unit Tests
- Mock `OCREngine` and `StorageProvider`
- Test route logic in isolation
- Test engine implementations independently

### Integration Tests
- Spin up service with memory storage + Tesseract
- Upload real PDFs, verify OCR output
- Test auth middleware

### Performance Tests
- Measure throughput (requests/sec)
- Measure latency per engine
- Test concurrent requests

## Security Considerations

1. **API Key Auth:** Required on all endpoints except `/health`
2. **File Size Limits:** Enforced at upload (`max_file_size_bytes`)
3. **File Type Validation:** Only allowed extensions processed
4. **No External URLs:** Files must be uploaded first (no arbitrary URL fetching)
5. **Internal Network:** Service not exposed externally (Docker network only)

## Performance Characteristics

### Tesseract (CPU)
- **Startup:** ~1s (loading language data)
- **Single page:** ~1-2s
- **10-page PDF:** ~10-20s
- **Memory:** ~200MB base + ~50MB per concurrent request
- **CPU:** 100% of 1 core per request

### Memory Storage
- **Latency:** <1ms (in-RAM)
- **Throughput:** Limited only by RAM
- **Scalability:** Single instance only

### Future: PaddleOCR (GPU)
- **Startup:** ~5s (loading models to GPU)
- **Single page:** ~0.2s
- **10-page PDF:** ~2s
- **Memory:** ~2GB GPU RAM
- **Throughput:** 10-20x Tesseract

## Deployment Patterns

### Single Instance (Current)
```
LibreChat → ocr-service:8000 → Tesseract
```
- Simple, no orchestration needed
- Memory storage sufficient
- Good for <100 users

### Multi-Instance (Future)
```
LibreChat → Load Balancer → [ocr-service-1, ocr-service-2, ...]
                                ↓
                             S3 Storage
```
- Horizontal scaling
- Requires S3 or shared storage
- Good for >100 users

### GPU-Accelerated (Future)
```
LibreChat → ocr-service (GPU) → PaddleOCR/EasyOCR
```
- Requires GPU passthrough
- Much faster processing
- Higher resource cost

## Monitoring Hooks

Future additions:

- Prometheus metrics endpoint (`/metrics`)
- Request duration histograms
- Error rate counters
- GPU utilization (if applicable)
- Storage usage gauges

## Known Limitations

1. **Tesseract accuracy:** Not as good as modern transformers
2. **Memory storage:** Not production-ready (files lost on restart)
3. **No batch processing:** One file at a time
4. **No caching:** Same file OCR'd multiple times
5. **No layout detection:** Plain text extraction only

## Future Enhancements

1. **Layout Analysis:** Detect headers, paragraphs, tables
2. **Table Extraction:** Parse tables into structured data
3. **Image Extraction:** Extract embedded images with captions
4. **Batch API:** Process multiple files in one request
5. **Result Caching:** Cache OCR results by file hash
6. **Streaming:** Stream results page-by-page for large PDFs
7. **Preprocessing:** Auto-rotate, deskew, denoise images

