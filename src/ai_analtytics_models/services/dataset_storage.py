"""Dataset object storage with a local-filesystem fallback for development.

When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured, Supabase
Storage is the source of truth. Local files are a disposable cache so the
existing Pandas-based analysis paths can remain simple.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _storage_config() -> tuple[str, str, str] | None:
    """Return Storage config, or None when local-only development is active."""
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    # Prefer the modern server-side secret key; also accept the legacy
    # service_role JWT for compatibility with existing Supabase projects.
    service_key = (
        os.getenv("SUPABASE_SECRET_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "insightflow-datasets").strip()

    if not url and not service_key:
        return None
    if not url or not service_key:
        raise RuntimeError(
            "Supabase Storage is partially configured. Set SUPABASE_URL and "
            "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY), "
            "or unset both to use local filesystem storage."
        )
    if not bucket:
        raise RuntimeError("SUPABASE_STORAGE_BUCKET cannot be empty.")

    return url, service_key, bucket


def supabase_storage_enabled() -> bool:
    """Whether Supabase Storage is configured for dataset files."""
    return _storage_config() is not None


def _object_path(user_id: int, stored_filename: str) -> str:
    # Only server-generated UUID filenames are accepted by the router.
    filename = Path(stored_filename)
    if filename.name != stored_filename or filename.is_absolute():
        raise ValueError("Invalid stored dataset filename.")
    return f"{user_id}/{stored_filename}"


def _request_storage(
    method: str,
    *,
    url: str,
    service_key: str,
    body: bytes | None = None,
    content_type: str | None = None,
    upsert: bool = False,
) -> bytes:
    headers = {"apikey": service_key}
    # Legacy service_role keys are JWTs and need the Bearer header. Modern
    # sb_secret_* keys are opaque API keys; send them as apikey only.
    if service_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {service_key}"
    if content_type:
        headers["Content-Type"] = content_type
    if upsert:
        headers["x-upsert"] = "true"

    request = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=45) as response:
            return response.read()
    except HTTPError as exc:
        # Avoid including the URL or any credentials in logs/exceptions.
        response_body = exc.read(4096).decode("utf-8", errors="replace")
        try:
            parsed = json.loads(response_body)
            message = (
                parsed.get("message")
                or parsed.get("error")
                or parsed.get("statusCode")
                or "Storage request failed"
            ) if isinstance(parsed, dict) else "Storage request failed"
        except json.JSONDecodeError:
            message = "Storage request failed"
        raise RuntimeError(
            f"Supabase Storage returned HTTP {exc.code}: {message}"
        ) from None
    except URLError as exc:
        raise RuntimeError(
            "Could not reach Supabase Storage. Check the project URL and network."
        ) from exc


def _storage_object_url(base_url: str, bucket: str, path: str) -> str:
    bucket_segment = quote(bucket, safe="")
    path_segment = quote(path, safe="/")
    return f"{base_url}/storage/v1/object/{bucket_segment}/{path_segment}"


async def upload_dataset_object(
    *,
    user_id: int,
    stored_filename: str,
    contents: bytes,
    content_type: str,
) -> None:
    """Upload a dataset to Supabase when configured; otherwise do nothing."""
    config = _storage_config()
    if config is None:
        return

    base_url, service_key, bucket = config
    path = _object_path(user_id, stored_filename)
    url = _storage_object_url(base_url, bucket, path)
    await asyncio.to_thread(
        _request_storage,
        "POST",
        url=url,
        service_key=service_key,
        body=contents,
        content_type=content_type,
        upsert=True,
    )


async def ensure_dataset_object_cached(
    *,
    user_id: int,
    stored_filename: str,
    local_path: Path,
) -> bool:
    """Ensure the dataset is locally cached; return False if it is missing."""
    if local_path.is_file():
        return True

    config = _storage_config()
    if config is None:
        return False

    base_url, service_key, bucket = config
    path = _object_path(user_id, stored_filename)
    url = _storage_object_url(base_url, bucket, path)

    try:
        contents = await asyncio.to_thread(
            _request_storage,
            "GET",
            url=url,
            service_key=service_key,
        )
    except RuntimeError as exc:
        # Treat a genuinely missing object as missing dataset content; surface
        # configuration/network/permission errors so they aren't misdiagnosed.
        if "HTTP 404" in str(exc):
            return False
        raise

    local_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = local_path.with_suffix(local_path.suffix + ".part")
    try:
        temporary_path.write_bytes(contents)
        temporary_path.replace(local_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    return True


async def delete_dataset_object(
    *,
    user_id: int,
    stored_filename: str,
    local_path: Path,
) -> None:
    """Remove a stored dataset object (if configured) and its local cache."""
    config = _storage_config()

    try:
        if config is not None:
            base_url, service_key, bucket = config
            path = _object_path(user_id, stored_filename)
            # Supabase Storage's remove operation accepts a list of object
            # paths under the bucket endpoint.
            url = f"{base_url}/storage/v1/object/{quote(bucket, safe='')}"
            await asyncio.to_thread(
                _request_storage,
                "DELETE",
                url=url,
                service_key=service_key,
                body=json.dumps({"prefixes": [path]}).encode("utf-8"),
                content_type="application/json",
            )
    finally:
        local_path.unlink(missing_ok=True)
        local_path.with_suffix(local_path.suffix + ".part").unlink(
            missing_ok=True
        )
