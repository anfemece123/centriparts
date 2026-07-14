"""Centralized, typed environment configuration.

Mirrors the pattern already used on the TypeScript side
(supabase/functions/_shared/config.ts): every value is configurable via an
env var with a safe default, loaded once and passed around explicitly rather
than read from `os.environ` scattered across the codebase.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Security ────────────────────────────────────────────────────────
    # Shared secret the Edge Functions send as `X-Internal-Api-Key`. There is
    # no default: an empty key would make `security.py` accept any request,
    # so startup fails loudly instead (see security.py).
    visual_internal_api_key: str = ""

    # ── Active embedding provider ───────────────────────────────────────
    visual_embedding_provider: str = "dinov2"
    visual_embedding_model: str = "facebook/dinov2-small"
    visual_embedding_version: str = "v1"
    visual_embedding_dimensions: int = 384

    # ── Preprocessing ───────────────────────────────────────────────────
    visual_preprocessing_version: str = "v1"
    visual_max_image_mb: int = 8
    visual_normalized_image_size: int = 224

    # ── Local (non-OpenAI) reranking ────────────────────────────────────
    visual_local_rerank_enabled: bool = True
    visual_local_rerank_candidates: int = 15

    # ── OCR ──────────────────────────────────────────────────────────────
    visual_ocr_enabled: bool = True
    visual_ocr_timeout_seconds: float = 5.0

    # ── Operational limits ──────────────────────────────────────────────
    visual_request_timeout_seconds: float = 30.0
    visual_max_concurrency: int = 2
    visual_max_batch_size: int = 16
    visual_rate_limit_max_requests: int = 120
    visual_rate_limit_window_seconds: float = 60.0

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
