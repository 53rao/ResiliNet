"""Environment-backed settings for the M1 API shell."""

from __future__ import annotations

import os


DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
)


def get_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    if raw is None:
        return list(DEFAULT_ALLOWED_ORIGINS)

    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError("ALLOWED_ORIGINS must contain at least one exact origin")
    if "*" in origins:
        raise RuntimeError("ALLOWED_ORIGINS must use exact origins; wildcard is not allowed")
    return origins

