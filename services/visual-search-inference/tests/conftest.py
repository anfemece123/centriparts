from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import main, security
from app.config import Settings, get_settings
from tests.fakes import DummyVisualEmbeddingProvider

TEST_API_KEY = "test-internal-api-key"


def _test_settings() -> Settings:
    return Settings(
        visual_internal_api_key=TEST_API_KEY,
        visual_ocr_enabled=True,
        visual_rate_limit_max_requests=1000,
        visual_rate_limit_window_seconds=60.0,
    )


@pytest.fixture
def client():
    main.app.dependency_overrides[get_settings] = _test_settings
    main.app.dependency_overrides[main.get_provider] = DummyVisualEmbeddingProvider
    security._limiter = None  # avoid cross-test rate-limit pollution
    main._provider_singleton = None

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-Internal-Api-Key": TEST_API_KEY}
