import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import compat_router, router as api_router
from config import settings
from sandbox import session_manager
from utils.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="LibreChat Code Interpreter Proxy",
        version="0.1.0",
        docs_url=f"{settings.api_prefix}/docs",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)
    # Compatibility routes expected by LibreChat agents
    app.include_router(compat_router)

    @app.on_event("startup")
    async def startup_event() -> None:
        logger.info("Starting code-interpreter-proxy")
        await session_manager.start_cleanup_task()

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        logger.info("Stopping code-interpreter-proxy")
        await session_manager.stop_cleanup_task()

    return app


app = create_app()
