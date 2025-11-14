"""Authentication middleware for API key validation."""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate API key on all requests except health check."""

    def __init__(self, app, api_key: str):
        """Initialize auth middleware.
        
        Args:
            app: FastAPI application
            api_key: Expected API key for authentication
        """
        super().__init__(app)
        self.api_key = api_key

    async def dispatch(self, request: Request, call_next):
        """Validate API key before processing request."""
        # Skip auth for health endpoint
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        # Check Authorization header (Bearer token)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            if token == self.api_key:
                return await call_next(request)

        # Check x-api-key header (alternative)
        api_key_header = request.headers.get("x-api-key", "")
        if api_key_header == self.api_key:
            return await call_next(request)

        # Unauthorized
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid or missing API key"},
        )

