from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def healthcheck() -> dict:
    return {
        "status": "ok",
        "backend": "llm-sandbox",
        "languages": settings.supported_languages,
    }
