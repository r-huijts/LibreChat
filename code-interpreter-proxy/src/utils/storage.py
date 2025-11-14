import contextlib
import logging
import mimetypes
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

import aiofiles

from config import settings

logger = logging.getLogger(__name__)


class FileStorage:
    """Handles file storage and management for sessions."""

    def __init__(self) -> None:
        self.storage_path = Path(settings.file_storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _assert_session_capacity(self, session_id: str) -> None:
        session_path = self.storage_path / session_id
        if not session_path.exists():
            return
        file_dirs = [path for path in session_path.iterdir() if path.is_dir()]
        if len(file_dirs) >= settings.max_files_per_session:
            raise ValueError(f"Session has too many files. Max: {settings.max_files_per_session}")

    def _allocate_file_path(self, session_id: str, filename: str) -> Tuple[str, Path]:
        self._assert_session_capacity(session_id)
        safe_filename = Path(filename).name
        file_id = str(uuid.uuid4())
        file_dir = self.storage_path / session_id / file_id
        file_dir.mkdir(parents=True, exist_ok=False)
        return file_id, file_dir / safe_filename

    async def save_file(self, session_id: str, filename: str, content: bytes) -> Dict:
        """Persist an uploaded file for a specific session."""
        if len(content) > settings.max_file_size_bytes:
            raise ValueError(f"File too large. Max size: {settings.max_file_size_bytes} bytes")

        session_path = self.storage_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)

        file_id, file_path = self._allocate_file_path(session_id, filename)

        try:
            async with aiofiles.open(file_path, "wb") as file_handle:
                await file_handle.write(content)
        except Exception as exc:  # noqa: BLE001
            logger.error("Error saving file for session %s: %s", session_id, exc)
            self.remove_file_path(file_path)
            raise

        return self.metadata_from_path(file_id, file_path)

    def allocate_runtime_file(self, session_id: str, filename: str) -> Tuple[str, Path]:
        """Allocate a file path for sandbox output prior to copying from runtime."""
        session_path = self.storage_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        return self._allocate_file_path(session_id, filename)

    def metadata_from_path(self, file_id: str, file_path: Path) -> Dict:
        stat = file_path.stat()
        content_type, _ = mimetypes.guess_type(file_path.name)
        return {
            "id": file_id,
            "filename": file_path.name,
            "size": stat.st_size,
            "content_type": content_type or "application/octet-stream",
            "created_at": datetime.fromtimestamp(stat.st_ctime),
            "path": file_path,
        }

    def remove_file_path(self, file_path: Path) -> None:
        with contextlib.suppress(Exception):
            parent = file_path.parent
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()

    async def get_file(self, session_id: str, file_id: str) -> Optional[Path]:
        """Return the path to the stored file contents if present."""
        file_dir = self.storage_path / session_id / file_id
        if not file_dir.exists() or not file_dir.is_dir():
            return None

        for file_path in file_dir.iterdir():
            if file_path.is_file():
                return file_path
        return None

    async def find_file(self, file_id: str) -> Optional[Tuple[str, Path]]:
        """Locate a file across all sessions by id."""
        for session_dir in self.storage_path.iterdir():
            if not session_dir.is_dir():
                continue
            candidate_dir = session_dir / file_id
            if not candidate_dir.exists() or not candidate_dir.is_dir():
                continue
            file_path = next((p for p in candidate_dir.iterdir() if p.is_file()), None)
            if file_path:
                return session_dir.name, file_path
        return None

    async def get_file_metadata(self, session_id: str, file_id: str) -> Optional[Dict]:
        """Return metadata for a single file."""
        file_path = await self.get_file(session_id, file_id)
        if not file_path:
            return None
        return self.metadata_from_path(file_id, file_path)

    async def list_files(self, session_id: str) -> Dict:
        """Return metadata for all files uploaded within the session."""
        session_path = self.storage_path / session_id
        if not session_path.exists():
            return {"session_id": session_id, "files": [], "total": 0}

        files = []
        for file_dir in session_path.iterdir():
            if not file_dir.is_dir():
                continue

            file_path = next((p for p in file_dir.iterdir() if p.is_file()), None)
            if not file_path:
                continue

            files.append(self.metadata_from_path(file_dir.name, file_path))

        return {"session_id": session_id, "files": files, "total": len(files)}

    async def delete_file(self, session_id: str, file_id: str) -> bool:
        """Delete a stored file and its metadata."""
        file_dir = self.storage_path / session_id / file_id
        if not file_dir.exists():
            return False

        try:
            for child in file_dir.iterdir():
                if child.is_file():
                    child.unlink()
                else:
                    import shutil

                    shutil.rmtree(child)
            file_dir.rmdir()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Error deleting file %s from session %s: %s", file_id, session_id, exc)
            return False

    async def cleanup_session(self, session_id: str) -> bool:
        """Remove all stored data for a session."""
        session_path = self.storage_path / session_id
        if not session_path.exists():
            return False

        try:
            import shutil

            shutil.rmtree(session_path)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Error cleaning up session %s: %s", session_id, exc)
            return False


# Global file storage instance
file_storage = FileStorage()
