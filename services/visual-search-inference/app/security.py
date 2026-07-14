"""Internal auth + best-effort rate limiting.

This service is never exposed to the browser (spec section 5/27) — only
Supabase Edge Functions call it, over a private URL, using a shared secret.
There is deliberately no session/JWT model here: it's a single trusted
caller, not a multi-tenant API.
"""

from __future__ import annotations

import hmac
import time
from collections import defaultdict, deque

from fastapi import Depends, Header, HTTPException, Request, status

from app.config import Settings, get_settings


class MissingApiKeyConfigError(RuntimeError):
    """Raised at startup if VISUAL_INTERNAL_API_KEY was never configured."""


def require_api_key_configured(settings: Settings = Depends(get_settings)) -> None:
    if not settings.visual_internal_api_key:
        # Fail loudly rather than silently accepting every request.
        raise MissingApiKeyConfigError(
            "internal_api_key is not configured — refusing to serve authenticated endpoints.",
        )


def verify_api_key(
    x_internal_api_key: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    require_api_key_configured(settings)
    key_matches = x_internal_api_key is not None and hmac.compare_digest(
        x_internal_api_key, settings.visual_internal_api_key,
    )
    if not key_matches:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")


class SlidingWindowRateLimiter:
    """In-memory, single-process sliding window limiter.

    This service runs as a single small container behind the Edge Functions
    (not a public multi-instance API), so a per-process limiter is a
    deliberate, documented simplification — not a distributed rate limiter.
    If this service is ever scaled to multiple replicas, this must move to a
    shared store (e.g. Redis); tracked as a known limitation.
    """

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)
        return True


_limiter: SlidingWindowRateLimiter | None = None


def get_rate_limiter(settings: Settings = Depends(get_settings)) -> SlidingWindowRateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = SlidingWindowRateLimiter(
            max_requests=settings.visual_rate_limit_max_requests,
            window_seconds=settings.visual_rate_limit_window_seconds,
        )
    return _limiter


def enforce_rate_limit(
    request: Request,
    limiter: SlidingWindowRateLimiter = Depends(get_rate_limiter),
) -> None:
    client_key = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")
