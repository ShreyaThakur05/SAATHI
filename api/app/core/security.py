import hashlib
import hmac
import os
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import Settings
from app.core.errors import AppError

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def issue_token(settings: Settings, claims: dict[str, Any], ttl_minutes: int | None = None) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=ttl_minutes or settings.token_ttl_minutes)
    return jwt.encode(
        {**claims, "exp": exp}, settings.jwt_secret.get_secret_value(), algorithm="HS256"
    )


def decode_token(settings: Settings, token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret.get_secret_value(), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise AppError("invalid_token", "Invalid or expired token", 401) from exc


class RateLimiter:
    """Sliding-window limiter. In-memory, so per process: use Redis if you scale out."""

    def __init__(self, limit: int, window_s: float) -> None:
        self._limit, self._window = limit, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            raise AppError("rate_limited", "Too many requests, please slow down", 429)
        hits.append(now)
