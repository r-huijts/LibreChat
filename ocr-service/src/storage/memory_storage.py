"""In-memory storage implementation (for development/testing)."""

import time
from typing import Optional
from .base import StorageProvider, StoredFile


class MemoryStorage(StorageProvider):
    """In-memory file storage.
    
    Suitable for development and testing. Files are lost on restart.
    For production, use LocalStorage or S3Storage.
    """

    def __init__(self, base_url: str = "http://ocr-service:8000"):
        """Initialize in-memory storage.
        
        Args:
            base_url: Base URL for generating file access URLs
        """
        self.base_url = base_url.rstrip("/")
        self._files: dict[str, tuple[bytes, StoredFile]] = {}

    async def save_file(
        self,
        file_id: str,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> StoredFile:
        """Save file to memory."""
        metadata = StoredFile(
            file_id=file_id,
            filename=filename,
            content_type=content_type,
            size_bytes=len(content),
            created_at=int(time.time()),
            purpose="ocr",
        )
        self._files[file_id] = (content, metadata)
        return metadata

    async def get_file(self, file_id: str) -> Optional[tuple[bytes, StoredFile]]:
        """Retrieve file from memory."""
        return self._files.get(file_id)

    async def delete_file(self, file_id: str) -> bool:
        """Delete file from memory."""
        if file_id in self._files:
            del self._files[file_id]
            return True
        return False

    async def get_file_url(self, file_id: str, expiry_hours: int = 24) -> Optional[str]:
        """Generate an internal URL for the file."""
        if file_id not in self._files:
            return None
        return f"{self.base_url}/v1/files/{file_id}/download"

    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists in memory."""
        return file_id in self._files

    async def cleanup_old_files(self, max_age_hours: int):
        """Remove files older than max_age_hours."""
        current_time = int(time.time())
        max_age_seconds = max_age_hours * 3600

        to_delete = []
        for file_id, (_, metadata) in self._files.items():
            if current_time - metadata.created_at > max_age_seconds:
                to_delete.append(file_id)

        for file_id in to_delete:
            del self._files[file_id]

        if to_delete:
            print(f"Cleaned up {len(to_delete)} old files from memory storage")

