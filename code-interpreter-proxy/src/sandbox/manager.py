import asyncio
import base64
import contextlib
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from llm_sandbox import ArtifactSandboxSession, SandboxBackend
from llm_sandbox.data import ConsoleOutput, ExecutionResult, PlotOutput
from llm_sandbox.exceptions import SandboxTimeoutError
from starlette.concurrency import run_in_threadpool

from config import settings
from models.runs import RunFileMetadata, RunRequest, RunStats
from utils.storage import file_storage

CLEANUP_INTERVAL_SECONDS = 60
SANDBOX_WORKDIR = "/sandbox"
INTERNAL_FILE_PATTERN = re.compile(r"^[0-9a-f]{32}\.\w+")
PLOT_SETUP_MESSAGE = "Python plot detection setup complete"


logger = logging.getLogger(__name__)


@dataclass
class RunResult:
    stdout: str
    stderr: str
    exit_code: int
    files: List[RunFileMetadata]
    stats: RunStats


class SandboxSessionWrapper:
    """Wrapper around llm-sandbox session with additional metadata."""

    def __init__(self, session_id: str, language: str) -> None:
        self.session_id = session_id
        self.language = language
        self.created_at = datetime.utcnow()
        self.last_activity = self.created_at
        self._session: Optional[ArtifactSandboxSession] = None
        self._lock = asyncio.Lock()

    async def open(self) -> None:
        if self._session is not None:
            return

        backend = SandboxBackend(settings.backend)

        def _create() -> None:
            session = ArtifactSandboxSession(
                backend=backend,
                lang=self.language,
                workdir=SANDBOX_WORKDIR,
                verbose=False,
                enable_plotting=True,
            )
            session.open()
            self._session = session

        logger.info("Opening sandbox session %s (language: %s)", self.session_id, self.language)
        await run_in_threadpool(_create)
        logger.info("Sandbox session %s opened successfully", self.session_id)

    async def close(self) -> None:
        if self._session is None:
            logger.debug("Session %s already closed or never opened", self.session_id)
            return

        logger.info("Closing sandbox session %s", self.session_id)
        def _close() -> None:
            self._session.close()

        await run_in_threadpool(_close)
        self._session = None
        logger.info("Sandbox session %s closed successfully", self.session_id)

    def is_expired(self) -> bool:
        return datetime.utcnow() > self.created_at + timedelta(minutes=settings.session_ttl_minutes)

    def touch(self) -> None:
        self.last_activity = datetime.utcnow()

    async def run(self, payload: RunRequest, file_records: List[Dict]) -> RunResult:
        await self.open()

        async with self._lock:
            self.touch()
            execution_timeout = min(
                payload.timeout_seconds or settings.max_run_timeout_seconds,
                settings.max_run_timeout_seconds,
            )

            await self._sync_files(file_records)
            before_snapshot = await self._snapshot_runtime()

            start = time.perf_counter()
            try:
                exec_result: ExecutionResult = await run_in_threadpool(
                    self._session.run,  # type: ignore[arg-type]
                    payload.code,
                    libraries=None,
                    timeout=execution_timeout,
                    clear_plots=True,
                )
            except SandboxTimeoutError as exc:  # pragma: no cover - mapped by caller
                raise exc
            wall_time = time.perf_counter() - start

            after_snapshot = await self._snapshot_runtime()
            output_files = await self._collect_outputs(before_snapshot, after_snapshot)
            if exec_result.plots:
                logger.info(
                    "Captured %d plot(s) from ArtifactSandboxSession for session %s",
                    len(exec_result.plots),
                    self.session_id,
                )
                plot_artifacts = await self._persist_plots(exec_result.plots)
                output_files.extend(plot_artifacts)
            else:
                logger.debug("No plots captured for session %s", self.session_id)

            stats = RunStats(
                cpu_time_seconds=wall_time,
                wall_time_seconds=wall_time,
                memory_bytes=0,
            )

            stdout = exec_result.stdout or ""
            if PLOT_SETUP_MESSAGE in stdout:
                stdout = stdout.replace(PLOT_SETUP_MESSAGE, "").lstrip("\n")
            
            # If stdout is empty but we have plots, provide a helpful message
            if not stdout.strip() and exec_result.plots:
                plot_count = len(exec_result.plots)
                plot_word = "plot" if plot_count == 1 else "plots"
                stdout = f"Generated {plot_count} {plot_word}"

            return RunResult(
                stdout=stdout,
                stderr=exec_result.stderr or "",
                exit_code=exec_result.exit_code,
                files=output_files,
                stats=stats,
            )

    async def _sync_files(self, file_records: List[Dict]) -> None:
        if not file_records:
            return

        for record in file_records:
            src_path: Path = record["path"]
            dest_path = f"{SANDBOX_WORKDIR}/{record['filename']}"

            def _copy() -> None:
                self._session.copy_to_runtime(str(src_path), dest_path)  # type: ignore[call-arg]

            await run_in_threadpool(_copy)

    async def _snapshot_runtime(self) -> Dict[str, Dict[str, float]]:
        cmd = (
            "find {workdir} -maxdepth 1 -type f -printf '%f|%s|%T@\\n'"
        ).format(workdir=SANDBOX_WORKDIR)

        def _execute() -> ConsoleOutput:
            return self._session.execute_command(cmd)  # type: ignore[call-arg]

        output: ConsoleOutput = await run_in_threadpool(_execute)
        snapshot: Dict[str, Dict[str, float]] = {}
        if output.exit_code != 0:
            return snapshot

        for line in output.stdout.splitlines():
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) != 3:
                continue
            name, size, mtime = parts
            snapshot[name] = {"size": float(size), "mtime": float(mtime)}
        return snapshot

    async def _collect_outputs(
        self,
        before: Dict[str, Dict[str, float]],
        after: Dict[str, Dict[str, float]],
    ) -> List[RunFileMetadata]:
        generated: List[RunFileMetadata] = []
        for name, meta in after.items():
            if INTERNAL_FILE_PATTERN.match(name):
                continue
            previous = before.get(name)
            if previous and previous == meta:
                continue

            try:
                file_id, dest_path = file_storage.allocate_runtime_file(self.session_id, name)
            except ValueError:
                # Session reached file capacity, skip exporting
                continue

            def _copy() -> None:
                self._session.copy_from_runtime(f"{SANDBOX_WORKDIR}/{name}", dest_path.as_posix())  # type: ignore[call-arg]

            try:
                await run_in_threadpool(_copy)
            except FileNotFoundError:
                file_storage.remove_file_path(dest_path)
                continue

            metadata = file_storage.metadata_from_path(file_id, dest_path)
            generated.append(
                RunFileMetadata(
                    id=file_id,
                    name=metadata["filename"],
                    size_bytes=metadata["size"],
                    mime_type=metadata["content_type"],
                    created_at=metadata["created_at"],
                )
            )

        return generated

    async def _persist_plots(self, plots: List[PlotOutput]) -> List[RunFileMetadata]:
        artifacts: List[RunFileMetadata] = []
        for plot in plots:
            try:
                extension = plot.format.value if hasattr(plot.format, "value") else plot.format
                filename = f"{uuid.uuid4().hex}.{extension}"
                file_id, dest_path = file_storage.allocate_runtime_file(self.session_id, filename)
                content_bytes = base64.b64decode(plot.content_base64, validate=True)
                with open(dest_path, "wb") as file_handle:
                    file_handle.write(content_bytes)
                metadata = file_storage.metadata_from_path(file_id, dest_path)
                artifacts.append(
                    RunFileMetadata(
                        id=file_id,
                        name=metadata["filename"],
                        size_bytes=metadata["size"],
                        mime_type=metadata["content_type"],
                        created_at=metadata["created_at"],
                        width=plot.width,
                        height=plot.height,
                        dpi=plot.dpi,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Failed to persist captured plot for session %s: %s",
                    self.session_id,
                    exc,
                )
        return artifacts


class SessionManager:
    """Manages sandbox sessions with llm-sandbox integration."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SandboxSessionWrapper] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None

    async def get_or_create(self, session_id: str, language: str) -> SandboxSessionWrapper:
        async with self._lock:
            existing = self._sessions.get(session_id)
            if existing:
                if existing.language != language:
                    await existing.close()
                    await file_storage.cleanup_session(session_id)
                    wrapper = SandboxSessionWrapper(session_id, language)
                    self._sessions[session_id] = wrapper
                    return wrapper
                return existing

            wrapper = SandboxSessionWrapper(session_id, language)
            self._sessions[session_id] = wrapper
            return wrapper

    async def run_code(self, payload: RunRequest, file_records: List[Dict]) -> RunResult:
        if payload.files and len(payload.files) > settings.max_files_per_run:
            raise ValueError(
                f"Too many files requested for run. Max allowed: {settings.max_files_per_run}"
            )

        wrapper = await self.get_or_create(payload.session_id, payload.language)
        try:
            return await wrapper.run(payload, file_records)
        except SandboxTimeoutError:
            raise
        except Exception:
            await wrapper.close()
            async with self._lock:
                self._sessions.pop(payload.session_id, None)
            raise

    async def delete_session(self, session_id: str) -> bool:
        async with self._lock:
            wrapper = self._sessions.pop(session_id, None)

        if not wrapper:
            logger.warning("Attempted to delete non-existent session %s", session_id)
            return False

        logger.info("Deleting session %s", session_id)
        await wrapper.close()
        await file_storage.cleanup_session(session_id)
        logger.info("Session %s deleted successfully", session_id)
        return True

    async def start_cleanup_task(self) -> None:
        if self._cleanup_task and not self._cleanup_task.done():
            logger.info("Cleanup task already running")
            return
        logger.info(
            "Starting session cleanup task (TTL: %d minutes, interval: %d seconds)",
            settings.session_ttl_minutes,
            CLEANUP_INTERVAL_SECONDS,
        )
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup_task(self) -> None:
        if not self._cleanup_task:
            return
        logger.info("Stopping session cleanup task")
        self._cleanup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._cleanup_task
        self._cleanup_task = None
        logger.info("Cleanup task stopped")

    async def _cleanup_loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
                await self._cleanup_expired_sessions()
        except asyncio.CancelledError:  # pragma: no cover
            return

    async def _cleanup_expired_sessions(self) -> None:
        expired: List[str] = []
        async with self._lock:
            active_count = len(self._sessions)
            for session_id, wrapper in list(self._sessions.items()):
                if wrapper.is_expired():
                    age_minutes = (datetime.utcnow() - wrapper.created_at).total_seconds() / 60
                    logger.info(
                        "Session %s expired (age: %.1f minutes, TTL: %d minutes)",
                        session_id,
                        age_minutes,
                        settings.session_ttl_minutes,
                    )
                    expired.append(session_id)

        if expired:
            logger.info("Cleaning up %d expired session(s) out of %d active", len(expired), active_count)
            for session_id in expired:
                await self.delete_session(session_id)
        else:
            logger.debug("No expired sessions to clean up (active: %d)", active_count)


session_manager = SessionManager()
