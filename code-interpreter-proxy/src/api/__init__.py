from fastapi import APIRouter

from . import files, health, runs
from .compat import router as compat_router

router = APIRouter()
router.include_router(runs.router)
router.include_router(files.router)
router.include_router(health.router)

__all__ = ["router", "compat_router"]
