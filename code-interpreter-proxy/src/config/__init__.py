from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    api_prefix: str = "/v1/librechat"
    ci_api_key: str = Field(default="dev-ci-key", description="Must match LIBRECHAT_CODE_API_KEY")
    backend: str = "docker"
    max_memory_mb: int = 512
    max_run_timeout_seconds: int = 30
    session_ttl_minutes: int = 60
    sandbox_image_prefixes: List[str] = Field(
        default_factory=lambda: ["ghcr.io/vndee/sandbox-", "lfnovo/open_notebook"],
        description="Image prefixes used by llm-sandbox containers",
    )
    sandbox_label: Optional[str] = Field(
        default=None,
        description="Optional Docker label to filter llm-sandbox containers",
    )
    sandbox_sweep_on_startup: bool = Field(
        default=True,
        description="Whether to prune stale llm-sandbox containers on startup",
    )
    file_storage_path: str = "/data/code-interpreter"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Supported languages mapping to llm-sandbox
    supported_languages: List[str] = ["python", "javascript", "java", "cpp", "go", "r"]
    
    # File upload limits
    max_file_size_bytes: int = 10 * 1024 * 1024  # 10MB
    max_files_per_session: int = 100
    max_files_per_run: int = 10
    
    class Config:
        env_prefix = "CI_"
        case_sensitive = False


settings = Settings()

# Ensure file storage directory exists
os.makedirs(settings.file_storage_path, exist_ok=True)
