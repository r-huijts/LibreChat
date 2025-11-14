# Quick Start Guide

Get the OCR service running in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- LibreChat repository cloned

## Step 1: Verify File Structure

Ensure you have:

```
/workspaces/
├── docker-compose.override.yml  (updated)
├── librechat.yaml              (updated)
├── .env                        (add OCR_API_KEY)
└── ocr-service/
    ├── Dockerfile
    ├── pyproject.toml
    ├── README.md
    └── src/
        ├── main.py
        ├── config.py
        ├── routes.py
        ├── models/
        ├── engines/
        ├── storage/
        └── middleware/
```

## Step 2: Add API Key to .env

Edit `/workspaces/.env` and add:

```bash
# OCR Service
OCR_API_KEY=your-secret-key-here
```

**Important:** Use a strong, random key for production!

```bash
# Generate a secure key:
openssl rand -hex 32
```

## Step 3: Build and Start the Service

```bash
cd /workspaces
docker-compose up --build ocr-service
```

You should see:

```
ocr-service | INFO:     Starting OCR service...
ocr-service | INFO:     OCR Engine: tesseract
ocr-service | INFO:     Storage Backend: memory
ocr-service | INFO:     OCR engine initialized: tesseract-5.3.0
ocr-service | INFO:     Application startup complete.
```

## Step 4: Test the Service

### Health Check

```bash
curl http://localhost:8000/health
```

Expected output:

```json
{
  "status": "ok",
  "engine": "tesseract-5.3.0",
  "gpu_available": false
}
```

### Upload a File

```bash
curl -X POST http://localhost:8000/v1/files \
  -H "Authorization: Bearer your-secret-key-here" \
  -F "file=@/path/to/test.pdf" \
  -F "purpose=ocr"
```

Expected output:

```json
{
  "id": "abc-123-def",
  "object": "file",
  "bytes": 123456,
  "created_at": 1234567890,
  "filename": "test.pdf",
  "purpose": "ocr"
}
```

### Perform OCR

```bash
curl -X POST http://localhost:8000/v1/ocr \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tesseract",
    "document": {
      "type": "document_url",
      "document_url": "abc-123-def"
    }
  }'
```

Expected output:

```json
{
  "pages": [
    {
      "index": 0,
      "markdown": "Extracted text content here...",
      "images": [],
      "dimensions": {
        "dpi": 300,
        "height": 1200,
        "width": 800
      }
    }
  ],
  "model": "tesseract-5.3.0",
  "usage_info": {
    "pages_processed": 1,
    "doc_size_bytes": 123456
  }
}
```

## Step 5: Start All Services

```bash
docker-compose up -d
```

This starts:
- LibreChat API
- MongoDB
- Meilisearch
- RAG API
- Code Interpreter Proxy
- SearXNG
- **OCR Service** ← New!

## Step 6: Test with LibreChat

1. Open LibreChat in your browser
2. Start a conversation with an agent
3. Enable the "OCR" capability
4. Upload a PDF or image
5. Ask the AI to extract text from it

The AI should receive the OCR'd text and can answer questions about the document!

## Configuration

### Change OCR Engine (Future)

Edit `docker-compose.override.yml`:

```yaml
ocr-service:
  environment:
    - OCR_ENGINE=paddleocr  # Instead of tesseract
```

### Add More Languages

Edit `ocr-service/Dockerfile`:

```dockerfile
RUN apt-get update && apt-get install -y \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-spa
```

Then set:

```yaml
OCR_TESSERACT_LANG=eng,fra,deu,spa
```

### Increase File Size Limit

```yaml
ocr-service:
  environment:
    - OCR_MAX_FILE_SIZE_MB=20  # Default is 10
```

### Enable Persistent Storage (Future)

```yaml
ocr-service:
  environment:
    - OCR_STORAGE_BACKEND=local  # Instead of memory
    - OCR_STORAGE_PATH=/data/ocr
  volumes:
    - ./ocr-data:/data/ocr  # Persist files on host
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker logs ocr-service
```

**Common issues:**
- Missing dependencies in Dockerfile
- Port conflict (change `OCR_PORT`)
- Out of memory (increase Docker RAM limit)

### OCR Quality is Poor

**Try different PSM mode:**
```yaml
OCR_TESSERACT_PSM=6  # Single uniform block of text
```

**Add preprocessing:**
- Convert images to grayscale
- Increase DPI (edit `src/engines/tesseract_engine.py`)
- Use a better OCR engine (PaddleOCR, EasyOCR)

### File Upload Fails

**Check file size:**
```bash
# Increase limit
OCR_MAX_FILE_SIZE_MB=50
```

**Check file type:**
- Supported: PDF, JPG, PNG, BMP, TIFF, WEBP
- Check `src/routes.py` for exact extensions

### "Unauthorized" Error

**Verify API key matches:**
- `.env`: `OCR_API_KEY=your-key`
- `librechat.yaml`: `apiKey: "${OCR_API_KEY}"`

**Check header format:**
```bash
# Either format works:
-H "Authorization: Bearer your-key"
-H "x-api-key: your-key"
```

## Next Steps

- **Production Hardening:** See `README.md`
- **Add GPU Support:** See `ARCHITECTURE.md`
- **Swap OCR Engine:** See `README.md` → "Adding a New OCR Engine"
- **Monitor Performance:** Add Prometheus metrics (future)

## Support

- **Service Issues:** Check `README.md` and `ARCHITECTURE.md`
- **LibreChat Integration:** See LibreChat docs
- **Tesseract Tuning:** https://tesseract-ocr.github.io/

## Clean Up

Stop the service:

```bash
docker-compose stop ocr-service
```

Remove containers and volumes:

```bash
docker-compose down -v
```

Remove images:

```bash
docker rmi $(docker images | grep ocr-service | awk '{print $3}')
```

---

**You're all set!** The OCR service is now running and integrated with LibreChat. 🎉

