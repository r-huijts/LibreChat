# OCR Docker Deployment Options for LibreChat

## Executive Summary

Based on your existing architecture with `searxng` and `code-interpreter-proxy`, you have **multiple options** for running OCR through your own Docker infrastructure. The current LibreChat OCR implementation supports 4 strategies, but only **one** (`custom_ocr`) is designed for self-hosted services.

---

## Current State Analysis

### Existing Dockerized Services Pattern

Your setup follows this pattern:

1. **SearXNG** (Web Search)
   - Service: `searxng:8080`
   - Configuration: `./searxng/settings.yml`
   - Discovery: Internal DNS (`http://searxng:8080`)
   - Integration: MCP server references it via `SEARXNG_URL` env var

2. **Code Interpreter Proxy**
   - Service: `code-interpreter-proxy:8000`
   - Build: Custom Dockerfile in `./code-interpreter-proxy/`
   - Discovery: `http://code-interpreter-proxy:8000`
   - Integration: LibreChat uses `LIBRECHAT_CODE_BASEURL` and `LIBRECHAT_CODE_API_KEY`

---

## OCR Strategies Explained

LibreChat currently supports 4 OCR strategies:

### 1. `mistral_ocr` (Default - External API)
**Status:** ❌ Not self-hostable  
**How it works:** Calls Mistral's public API at `https://api.mistral.ai/v1/ocr`

**Required Config:**
```yaml
ocr:
  mistralModel: "mistral-ocr-latest"
  apiKey: "${OCR_API_KEY}"
  baseURL: "https://api.mistral.ai/v1"
  strategy: "mistral_ocr"
```

**Environment Variables:**
- `OCR_API_KEY` - Your Mistral API key
- `OCR_BASEURL` (optional) - Defaults to `https://api.mistral.ai/v1`

**Verdict:** This is an external SaaS option, not self-hosted.

---

### 2. `azure_mistral_ocr` (Azure-hosted)
**Status:** ❌ Not self-hostable (cloud-only)  
**How it works:** Uses Mistral OCR models deployed on Azure AI Foundry

**Required Config:**
```yaml
ocr:
  mistralModel: "deployed-mistral-ocr-2503"  # Your Azure deployment name
  apiKey: "${AZURE_MISTRAL_OCR_API_KEY}"
  baseURL: "https://your-deployed-endpoint.models.ai.azure.com/v1"
  strategy: "azure_mistral_ocr"
```

**Verdict:** Requires Azure subscription and model deployment. Not self-hosted.

---

### 3. `vertexai_mistral_ocr` (Google Cloud)
**Status:** ❌ Not self-hostable (cloud-only)  
**How it works:** Uses Mistral OCR models deployed on Google Cloud Vertex AI

**Required Config:**
```yaml
ocr:
  mistralModel: "mistral-ocr-2505"
  strategy: "vertexai_mistral_ocr"
```

**Environment Variables:**
- `GOOGLE_SERVICE_KEY_FILE` - Path to service account JSON file

**Verdict:** Requires Google Cloud subscription. Not self-hosted.

---

### 4. `custom_ocr` (Self-Hostable!) ✅
**Status:** ✅ **THIS IS YOUR OPTION**  
**How it works:** Points to a custom OCR API endpoint that implements Mistral's OCR API contract

**Required Config:**
```yaml
ocr:
  apiKey: "${CUSTOM_OCR_API_KEY}"
  baseURL: "${CUSTOM_OCR_BASEURL}"  # e.g., "http://ocr-service:8000/v1"
  strategy: "custom_ocr"
```

**API Contract Required:**
Your custom OCR service must implement these endpoints:

1. **POST `/v1/files`** - Upload document for OCR
   - Content-Type: `multipart/form-data`
   - Fields: `file` (binary), `purpose` (string: "ocr")
   - Returns: `{ id, bytes, filename, purpose, object, created_at }`

2. **POST `/v1/ocr`** - Perform OCR on uploaded document
   - Content-Type: `application/json`
   - Body:
     ```json
     {
       "model": "mistral-ocr-latest",
       "image_limit": 0,
       "include_image_base64": false,
       "document": {
         "type": "document_url",
         "document_url": "https://files.mistral.ai/..."
       }
     }
     ```
   - Returns: OCR result with pages, markdown text, images, usage info

3. **GET `/v1/files/{file_id}/url?expiry=24`** - Get signed URL for uploaded file
   - Returns: `{ url, expires_at }`

4. **DELETE `/v1/files/{file_id}`** - Delete file

**Verdict:** This is your path forward for self-hosted OCR!

---

## Docker Deployment Options

### Option A: Build a Custom OCR Proxy (Recommended)

Create a proxy service similar to `code-interpreter-proxy` that wraps an OCR engine (Tesseract, PaddleOCR, EasyOCR, etc.) and exposes Mistral's API contract.

#### Architecture

```
LibreChat API
    ↓
    POST /v1/ocr
    ↓
ocr-service:8000 (Your custom proxy)
    ↓
Tesseract/PaddleOCR/EasyOCR
    ↓
Returns OCR result
```

#### Docker Compose Addition

```yaml
# In docker-compose.override.yml
services:
  api:
    depends_on:
      - ocr-service
    # No env vars needed in api service - configured via librechat.yaml

  ocr-service:
    build:
      context: ./ocr-service
      dockerfile: Dockerfile
    container_name: ocr-service
    environment:
      - OCR_API_KEY=${OCR_API_KEY:-your-secret-key}
      - OCR_PORT=8000
      - OCR_ENGINE=tesseract  # or paddleocr, easyocr
    volumes:
      - ocr_files:/data/ocr
    restart: unless-stopped
    # No ports exposed - internal only

volumes:
  ocr_files:
```

#### LibreChat Configuration

```yaml
# In librechat.yaml
ocr:
  apiKey: "${OCR_API_KEY}"
  baseURL: "http://ocr-service:8000/v1"
  strategy: "custom_ocr"
```

#### Environment Variables

```bash
# In .env
OCR_API_KEY=your-secret-key-here
```

**Pros:**
- ✅ Fully self-hosted
- ✅ No external API costs
- ✅ Privacy-compliant (data never leaves your infrastructure)
- ✅ Similar pattern to `code-interpreter-proxy`
- ✅ Can swap OCR engines easily

**Cons:**
- ⚠️ Requires building a new service
- ⚠️ Need to implement Mistral API contract
- ⚠️ OCR quality depends on chosen engine
- ⚠️ May need GPU for complex documents (models like LayoutLM, Donut)

---

### Option B: Use Existing OCR Docker Images with Adapter

Leverage existing OCR services (e.g., [jbarlow83/ocrmypdf](https://hub.docker.com/r/jbarlow83/ocrmypdf), [tesseract-ocr](https://github.com/tesseract-ocr/tesseract)) and build a thin adapter proxy.

#### Architecture

```
LibreChat API
    ↓
ocr-adapter:8000 (Thin proxy)
    ↓
tesseract-container or paddleocr-container
    ↓
OCR result converted to Mistral format
```

#### Docker Compose

```yaml
services:
  api:
    depends_on:
      - ocr-adapter

  ocr-adapter:
    build:
      context: ./ocr-adapter
      dockerfile: Dockerfile
    environment:
      - OCR_API_KEY=${OCR_API_KEY}
      - TESSERACT_URL=http://tesseract:8080
    restart: unless-stopped

  tesseract:
    image: tesseractshadow/tesseract4re:latest
    restart: unless-stopped
```

**Pros:**
- ✅ Reuse battle-tested OCR containers
- ✅ Smaller codebase (just adapter logic)
- ✅ Easy to swap OCR backends

**Cons:**
- ⚠️ Two containers instead of one
- ⚠️ Additional network hop

---

### Option C: Mistral OCR via Ollama (If Available)

If Mistral releases their OCR model for local inference via Ollama, you could use your existing Ollama setup.

**Status:** 🚧 Not currently available  
Mistral's OCR models are not yet available for local deployment via Ollama or other inference servers.

**If it becomes available:**

```yaml
# librechat.yaml
ocr:
  mistralModel: "mistral-ocr-latest"
  baseURL: "http://ollama:11434/v1"
  strategy: "custom_ocr"
```

**Verdict:** Not viable today, but monitor Mistral's releases.

---

### Option D: Cloud-Hosted with Proxy (Hybrid)

Keep using external APIs (Mistral, Azure, Google) but route through a caching proxy in your infrastructure.

**Not recommended** for privacy/cost reasons unless you need enterprise-grade accuracy.

---

## Recommended Implementation Plan

### Phase 1: Prototype OCR Service

1. **Create directory structure:**
   ```bash
   mkdir -p ocr-service/src
   cd ocr-service
   ```

2. **Create `Dockerfile`:**
   ```dockerfile
   FROM python:3.11-slim
   
   # Install OCR dependencies
   RUN apt-get update && apt-get install -y \
       tesseract-ocr \
       libtesseract-dev \
       poppler-utils \
       && rm -rf /var/lib/apt/lists/*
   
   WORKDIR /app
   
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   
   COPY src/ ./src/
   
   EXPOSE 8000
   
   CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

3. **Create `requirements.txt`:**
   ```txt
   fastapi==0.109.0
   uvicorn[standard]==0.27.0
   python-multipart==0.0.6
   pytesseract==0.3.10
   Pillow==10.2.0
   pdf2image==1.17.0
   python-magic==0.4.27
   ```

4. **Create `src/main.py`:**
   ```python
   from fastapi import FastAPI, File, UploadFile, HTTPException
   from fastapi.responses import JSONResponse
   import pytesseract
   from pdf2image import convert_from_bytes
   from PIL import Image
   import io
   import os
   from datetime import datetime
   import uuid
   
   app = FastAPI()
   
   API_KEY = os.getenv("OCR_API_KEY", "dev-ocr-key")
   
   # In-memory file storage (use disk/S3 for production)
   file_storage = {}
   
   @app.post("/v1/files")
   async def upload_file(file: UploadFile = File(...), purpose: str = "ocr"):
       """Upload a file for OCR processing."""
       if purpose != "ocr":
           raise HTTPException(400, "Only 'ocr' purpose is supported")
       
       file_id = str(uuid.uuid4())
       content = await file.read()
       
       file_storage[file_id] = {
           "id": file_id,
           "filename": file.filename,
           "content": content,
           "bytes": len(content),
           "created_at": int(datetime.now().timestamp()),
       }
       
       return {
           "id": file_id,
           "object": "file",
           "bytes": len(content),
           "created_at": int(datetime.now().timestamp()),
           "filename": file.filename,
           "purpose": purpose,
       }
   
   @app.post("/v1/ocr")
   async def perform_ocr(request: dict):
       """Perform OCR on document or image."""
       doc = request.get("document", {})
       doc_type = doc.get("type")
       
       # For simplicity, assuming document_url is a file_id
       # In production, handle both URLs and file IDs
       file_id = doc.get("document_url", "").split("/")[-1]
       
       if file_id not in file_storage:
           raise HTTPException(404, "File not found")
       
       file_data = file_storage[file_id]
       content = file_data["content"]
       
       # Perform OCR based on file type
       try:
           if file_data["filename"].lower().endswith(".pdf"):
               pages = convert_from_bytes(content)
               ocr_pages = []
               for idx, page in enumerate(pages):
                   text = pytesseract.image_to_string(page)
                   ocr_pages.append({
                       "index": idx,
                       "markdown": text,
                       "images": [],
                       "dimensions": {"dpi": 300, "height": page.height, "width": page.width}
                   })
           else:
               image = Image.open(io.BytesIO(content))
               text = pytesseract.image_to_string(image)
               ocr_pages = [{
                   "index": 0,
                   "markdown": text,
                   "images": [],
                   "dimensions": {"dpi": 300, "height": image.height, "width": image.width}
               }]
           
           return {
               "pages": ocr_pages,
               "model": "tesseract-4.0",
               "document_annotation": None,
               "usage_info": {
                   "pages_processed": len(ocr_pages),
                   "doc_size_bytes": file_data["bytes"]
               }
           }
       except Exception as e:
           raise HTTPException(500, f"OCR processing failed: {str(e)}")
   
   @app.get("/v1/files/{file_id}/url")
   async def get_file_url(file_id: str, expiry: int = 24):
       """Get a signed URL for the file."""
       if file_id not in file_storage:
           raise HTTPException(404, "File not found")
       
       # In production, generate real signed URLs
       return {
           "url": f"http://ocr-service:8000/v1/files/{file_id}/download",
           "expires_at": int(datetime.now().timestamp()) + (expiry * 3600)
       }
   
   @app.delete("/v1/files/{file_id}")
   async def delete_file(file_id: str):
       """Delete a file."""
       if file_id in file_storage:
           del file_storage[file_id]
       return {"deleted": True}
   
   @app.get("/health")
   async def health():
       return {"status": "ok"}
   ```

5. **Add to `docker-compose.override.yml`:**
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
       volumes:
         - ocr_files:/data/ocr
       restart: unless-stopped
   
   volumes:
     ocr_files:
   ```

6. **Update `librechat.yaml`:**
   ```yaml
   ocr:
     apiKey: "${OCR_API_KEY}"
     baseURL: "http://ocr-service:8000/v1"
     strategy: "custom_ocr"
   ```

7. **Update `.env`:**
   ```bash
   OCR_API_KEY=dev-ocr-key
   ```

8. **Build and test:**
   ```bash
   docker-compose up --build ocr-service
   ```

### Phase 2: Production Hardening

- Add authentication middleware
- Implement persistent file storage (S3, local volume)
- Add rate limiting
- Improve error handling
- Add monitoring/logging
- Support more file formats
- Consider GPU acceleration for complex documents

---

## Key Differences from Code-Interpreter-Proxy

| Aspect | Code Interpreter | OCR Service |
|--------|------------------|-------------|
| **Stateful** | Yes (sessions persist) | No (stateless per request) |
| **Container Creation** | Creates child Docker containers | Single service container |
| **File Management** | Multi-file per session | Single file per request |
| **Cleanup** | Session TTL-based | Immediate after OCR |
| **Complexity** | High (sandbox management) | Low (simple API proxy) |

---

## Alternative OCR Engines

If Tesseract doesn't meet your accuracy needs:

1. **PaddleOCR** (Better for multilingual)
   - Docker: `paddlecloud/paddleocr`
   - Pros: Better accuracy, supports layout analysis
   - Cons: Larger image, needs more resources

2. **EasyOCR** (GPU-accelerated)
   - Python library: `easyocr`
   - Pros: High accuracy, 80+ languages
   - Cons: Requires GPU for speed

3. **Surya** (Modern, layout-aware)
   - GitHub: vikparuchuri/surya
   - Pros: Better than Tesseract, layout detection
   - Cons: Requires GPU

4. **DocTR** (Document Text Recognition)
   - GitHub: mindee/doctr
   - Pros: Production-ready, good accuracy
   - Cons: Python-only

5. **Commercial APIs** (via custom_ocr proxy)
   - Google Document AI, Amazon Textract
   - Route through your proxy for caching/monitoring

---

## Security Considerations

1. **API Key Authentication:**
   - LibreChat sends `OCR_API_KEY` to your service
   - Validate in middleware: `x-api-key` header or `Authorization: Bearer`

2. **File Validation:**
   - Limit file sizes (10MB default in LibreChat)
   - Validate MIME types (PDFs, images only)
   - Scan for malware if processing user uploads

3. **Rate Limiting:**
   - Prevent abuse (e.g., 10 requests/minute per user)

4. **Network Isolation:**
   - Keep `ocr-service` on internal Docker network
   - No need to expose ports externally

---

## Cost Comparison

| Option | Cost | Privacy | Accuracy | Maintenance |
|--------|------|---------|----------|-------------|
| Mistral API | $$ (per page) | Low | High | None |
| Azure/GCP | $$$ (per page) | Low | High | Low |
| **Self-hosted Tesseract** | $ (compute only) | **High** | Medium | Medium |
| Self-hosted PaddleOCR | $$ (GPU compute) | High | High | Medium |
| Self-hosted Commercial | $$$ (licenses) | High | Very High | High |

---

## Testing Your OCR Service

```bash
# 1. Upload a file
curl -X POST http://localhost:8000/v1/files \
  -H "Authorization: Bearer dev-ocr-key" \
  -F "file=@test.pdf" \
  -F "purpose=ocr"

# Response: { "id": "file-123", ... }

# 2. Perform OCR
curl -X POST http://localhost:8000/v1/ocr \
  -H "Authorization: Bearer dev-ocr-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tesseract",
    "document": {
      "type": "document_url",
      "document_url": "file-123"
    }
  }'

# 3. Test via LibreChat
# Upload a PDF in LibreChat chat and enable OCR capability
```

---

## Summary

**TL;DR for your use case:**

1. ✅ **Use `custom_ocr` strategy** - it's designed for self-hosted services
2. ✅ **Build a simple FastAPI proxy** (like code-interpreter-proxy pattern)
3. ✅ **Wrap Tesseract or PaddleOCR** behind Mistral's API contract
4. ✅ **Add to docker-compose.override.yml** as `ocr-service`
5. ✅ **Configure via `librechat.yaml`** and `.env`

**The bad news:** LibreChat doesn't currently have a built-in mechanism to route OCR to self-hosted Mistral models (like Ollama does for LLMs). You need to build the API adapter yourself.

**The good news:** It's a simple REST API (4 endpoints), and you already have a template with `code-interpreter-proxy`!

---

## Next Steps

1. **Decide on OCR engine** (Tesseract for simplicity, PaddleOCR for accuracy)
2. **Build prototype service** (use Phase 1 code above)
3. **Test with LibreChat** (upload a PDF, verify OCR extraction)
4. **Iterate on accuracy** (tune OCR settings, try different engines)
5. **Production hardening** (auth, storage, monitoring)

---

*Need help building the service? I can generate a complete, production-ready OCR proxy service for you. Just say the word, and I'll whip up the full codebase with tests, Docker config, and documentation.* 🦇

