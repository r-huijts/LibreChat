"""Storage provider registry and factory."""

from typing import Dict, Type
from .base import StorageProvider
from .memory_storage import MemoryStorage


# Registry of available storage providers
_STORAGE_REGISTRY: Dict[str, Type[StorageProvider]] = {
    "memory": MemoryStorage,
    # Future storage providers:
    # "local": LocalStorage,
    # "s3": S3Storage,
}


def register_storage_provider(name: str, provider_class: Type[StorageProvider]):
    """Register a new storage provider.
    
    Args:
        name: Provider identifier (e.g., "s3")
        provider_class: StorageProvider subclass
    """
    _STORAGE_REGISTRY[name] = provider_class


def get_storage_provider(provider_name: str, config: dict) -> StorageProvider:
    """Factory function to create a storage provider instance.
    
    Args:
        provider_name: Name of the provider (e.g., "memory", "s3")
        config: Configuration dict for the provider
        
    Returns:
        Initialized StorageProvider instance
        
    Raises:
        ValueError: If provider_name is not registered
    """
    if provider_name not in _STORAGE_REGISTRY:
        available = ", ".join(_STORAGE_REGISTRY.keys())
        raise ValueError(
            f"Unknown storage provider: {provider_name}. Available: {available}"
        )

    provider_class = _STORAGE_REGISTRY[provider_name]
    return provider_class(**config)

