import logging
from datetime import datetime, timezone
from typing import List, Optional

import docker
from docker.errors import DockerException

logger = logging.getLogger(__name__)


def _parse_created(created: str) -> datetime:
    """Parse Docker created timestamp into aware datetime."""
    # Docker timestamps look like "2024-11-14T14:32:15.123456789Z"
    # Trim nanoseconds for fromisoformat
    if created.endswith("Z"):
        created = created[:-1] + "+00:00"
    if "." in created:
        prefix, suffix = created.split(".", 1)
        # limit microseconds to 6 digits
        suffix = suffix.split("+", 1)
        frac = suffix[0][:6]
        remainder = suffix[1] if len(suffix) > 1 else ""
        created = f"{prefix}.{frac}+{remainder}" if remainder else f"{prefix}.{frac}"
    return datetime.fromisoformat(created)


def sweep_stale_containers(
    ttl_minutes: int,
    image_prefixes: List[str],
    label: Optional[str] = None,
) -> None:
    """Remove llm-sandbox containers older than TTL minutes."""
    try:
        client = docker.from_env()
    except DockerException as exc:
        logger.warning("Docker sweep skipped: unable to connect to engine (%s)", exc)
        return

    filters = {}
    if label:
        filters["label"] = label

    try:
        containers = client.containers.list(all=True, filters=filters)
    except DockerException as exc:
        logger.warning("Docker sweep skipped: unable to list containers (%s)", exc)
        return

    if not containers:
        logger.info("Docker sweep: no containers matched filters (%s)", filters or "all")
        return

    cutoff_seconds = ttl_minutes * 60
    now = datetime.now(timezone.utc)
    removed = 0

    for container in containers:
        try:
            image_name = container.attrs.get("Config", {}).get("Image", "")
            tags = container.image.tags if container.image else []
            image_match = any(prefix in image_name for prefix in image_prefixes) or any(
                any(prefix in tag for prefix in image_prefixes) for tag in tags
            )
            if not image_match:
                continue

            created_str = container.attrs.get("Created")
            if not created_str:
                continue
            created_at = _parse_created(created_str)
            age = (now - created_at).total_seconds()
            if age < cutoff_seconds:
                continue

            logger.info(
                "Pruning stale sandbox container %s (image=%s, age_minutes=%.1f)",
                container.name,
                image_name or tags,
                age / 60,
            )
            if container.status == "running":
                container.stop(timeout=10)
            container.remove(force=True)
            removed += 1
        except DockerException as exc:
            logger.warning("Failed to remove container %s: %s", container.name, exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Unexpected error removing container %s: %s", container.name, exc)

    logger.info("Docker sweep complete: removed %d container(s)", removed)

