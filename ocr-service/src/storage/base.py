"""Base storage interface for file management."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class StoredFile:
    """Metadata for a stored file."""

    file_id: str
    filename: str
    content_type: str
    size_bytes: int
    created_at: int
    purpose: str = "ocr"


class StorageProvider(ABC):
    """Abstract storage provider for file upload/retrieval.
    
    This abstraction allows swapping between in-memory, local disk,
    S3, or other storage backends without changing the API layer.
    """

    @abstractmethod
    async def save_file(
        self,
        file_id: str,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> StoredFile:
        """Save a file to storage.
        
        Args:
            file_id: Unique identifier for the file
            filename: Original filename
            content: File content bytes
            content_type: MIME type
            
        Returns:
            StoredFile metadata
        """
        pass

    @abstractmethod
    async def get_file(self, file_id: str) -> Optional[tuple[bytes, StoredFile]]:
        """Retrieve a file from storage.
        
        Args:
            file_id: File identifier
            
        Returns:
            Tuple of (file_content, metadata) or None if not found
        """
        pass

    @abstractmethod
    async def delete_file(self, file_id: str) -> bool:
        """Delete a file from storage.
        
        Args:
            file_id: File identifier
            
        Returns:
            True if file was deleted, False if not found
        """
        pass

    @abstractmethod
    async def get_file_url(self, file_id: str, expiry_hours: int = 24) -> Optional[str]:
        """Get a URL for accessing the file.
        
        For local/memory storage, this might be a service-internal URL.
        For S3, this would be a pre-signed URL.
        
        Args:
            file_id: File identifier
            expiry_hours: URL validity period
            
        Returns:
            URL string or None if file not found
        """
        pass

    @abstractmethod
    async def file_exists(self, file_id: str) -> bool:
        """Check if a file exists.
        
        Args:
            file_id: File identifier
            
        Returns:
            True if file exists
        """
        pass

    async def cleanup_old_files(self, max_age_hours: int):
        """Clean up files older than max_age_hours.
        
        Optional method for storage providers that support TTL.
        
        Args:
            max_age_hours: Maximum file age in hours
        """
        pass

