import logging
from fastapi import Depends, Header, HTTPException, status

from config import settings

logger = logging.getLogger(__name__)


async def require_api_key(x_api_key: str = Header(..., alias="x-api-key")) -> str:
    """Validate the provided API key using the configured secret."""
    if x_api_key != settings.ci_api_key:
        logger.warning("Invalid API key presented")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return x_api_key


ApiKeyDependency = Depends(require_api_key)
