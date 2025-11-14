import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from llm_sandbox.exceptions import SandboxTimeoutError

from models.runs import RunRequest, RunResponse
from sandbox.manager import RunResult, session_manager
from utils.auth import require_api_key
from utils.storage import file_storage

router = APIRouter(prefix="/runs", tags=["runs"])

logger = logging.getLogger(__name__)


async def _resolve_files(session_id: str, file_ids: List[str]) -> List[dict]:
    file_records = []
    for file_id in file_ids:
        metadata = await file_storage.get_file_metadata(session_id, file_id)
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File '{file_id}' not found for session '{session_id}'",
            )
        file_records.append(
            {
                "id": file_id,
                "filename": metadata["filename"],
                "path": metadata["path"],
            }
        )
    return file_records


@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def execute_run(
    payload: RunRequest,
    _: str = Depends(require_api_key),
) -> RunResponse:
    file_records: List[dict] = []
    if payload.files:
        file_records = await _resolve_files(payload.session_id, payload.files)

    try:
        result: RunResult = await session_manager.run_code(payload, file_records)
    except SandboxTimeoutError:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Execution timed out")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error during code execution")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Execution failed") from exc

    return RunResponse(
        run_id=str(uuid.uuid4()),
        session_id=payload.session_id,
        language=payload.language,
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
        stats=result.stats,
        files=result.files,
    )
