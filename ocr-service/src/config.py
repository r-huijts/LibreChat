"""Configuration management using pydantic-settings."""

from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_prefix="OCR_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # API Configuration
    api_key: str = Field(
        default="dev-ocr-key",
        description="API key for authentication",
    )
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")

    # OCR Engine Configuration
    engine: Literal["tesseract", "paddleocr", "easyocr", "surya"] = Field(
        default="tesseract",
        description="OCR engine to use",
    )

    # GPU Configuration (for future use)
    use_gpu: bool = Field(
        default=False,
        description="Enable GPU acceleration (if supported by engine)",
    )
    gpu_device_id: int = Field(
        default=0,
        description="GPU device ID to use",
    )

    # Storage Configuration
    storage_backend: Literal["memory", "local", "s3"] = Field(
        default="memory",
        description="Storage backend for uploaded files",
    )
    storage_path: str = Field(
        default="/data/ocr",
        description="Local storage path for files",
    )
    s3_bucket: str = Field(
        default="",
        description="S3 bucket name (if using S3 storage)",
    )
    s3_region: str = Field(
        default="us-east-1",
        description="S3 region",
    )

    # File Processing Configuration
    max_file_size_mb: int = Field(
        default=10,
        description="Maximum file size in MB",
    )
    file_retention_hours: int = Field(
        default=24,
        description="How long to retain uploaded files (hours)",
    )

    # Tesseract-specific Configuration
    tesseract_lang: str = Field(
        default="eng",
        description="Tesseract language(s) - comma-separated (e.g., 'eng,fra')",
    )
    tesseract_psm: int = Field(
        default=3,
        description="Tesseract Page Segmentation Mode (0-13)",
    )
    tesseract_oem: int = Field(
        default=3,
        description="Tesseract OCR Engine Mode (0-3)",
    )

    # PaddleOCR Configuration (future use)
    paddle_lang: str = Field(
        default="en",
        description="PaddleOCR language",
    )
    paddle_det_model_dir: str = Field(
        default="",
        description="Path to PaddleOCR detection model",
    )
    paddle_rec_model_dir: str = Field(
        default="",
        description="Path to PaddleOCR recognition model",
    )

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level",
    )

    @property
    def max_file_size_bytes(self) -> int:
        """Convert max file size to bytes."""
        return self.max_file_size_mb * 1024 * 1024


# Global settings instance
settings = Settings()

