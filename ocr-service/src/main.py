"""FastAPI application entrypoint for OCR service."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .engines import get_engine
from .storage import get_storage_provider
from .middleware import AuthMiddleware
from .routes import router, health_router, set_dependencies


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown."""
    logger.info("Starting OCR service...")
    logger.info(f"OCR Engine: {settings.engine}")
    logger.info(f"Storage Backend: {settings.storage_backend}")
    logger.info(f"GPU Enabled: {settings.use_gpu}")

    # Initialize OCR engine
    engine_config = {
        "lang": settings.tesseract_lang,
        "psm": settings.tesseract_psm,
        "oem": settings.tesseract_oem,
        "use_gpu": settings.use_gpu,
        "gpu_device_id": settings.gpu_device_id,
    }
    ocr_engine = get_engine(settings.engine, engine_config)
    logger.info(f"OCR engine initialized: {ocr_engine.get_model_name()}")

    # Initialize storage provider
    storage_config = {}
    if settings.storage_backend == "local":
        storage_config = {"storage_path": settings.storage_path}
    elif settings.storage_backend == "s3":
        storage_config = {
            "bucket": settings.s3_bucket,
            "region": settings.s3_region,
        }
    storage = get_storage_provider(settings.storage_backend, storage_config)
    logger.info(f"Storage provider initialized: {settings.storage_backend}")

    # Set dependencies for routes
    set_dependencies(ocr_engine, storage)

    yield

    # Cleanup
    logger.info("Shutting down OCR service...")
    await ocr_engine.cleanup()


# Create FastAPI app
app = FastAPI(
    title="OCR Service",
    description="Modular OCR microservice implementing Mistral OCR API contract",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add authentication middleware
app.add_middleware(AuthMiddleware, api_key=settings.api_key)

# Register routes
app.include_router(router)
app.include_router(health_router)


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "OCR Service",
        "version": "0.1.0",
        "engine": settings.engine,
        "storage": settings.storage_backend,
        "gpu_enabled": settings.use_gpu,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level.lower(),
    )

