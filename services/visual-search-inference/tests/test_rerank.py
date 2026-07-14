from __future__ import annotations

import base64

import numpy as np
import pytest

from app.reranking.local_rerank import chamfer_patch_similarity, compute_local_similarity
from tests.fakes import DummyVisualEmbeddingProvider, make_test_image_bytes


def test_identical_patch_sets_score_close_to_one():
    patches = np.array([[1.0, 0.0], [0.0, 1.0]])
    score = chamfer_patch_similarity(patches, patches)
    assert score == pytest.approx(1.0, abs=1e-6)


def test_orthogonal_patch_sets_score_low():
    query = np.array([[1.0, 0.0]])
    candidate = np.array([[0.0, 1.0]])
    score = chamfer_patch_similarity(query, candidate)
    assert score == pytest.approx(0.0, abs=1e-6)


def test_score_is_always_within_zero_and_one():
    rng = np.random.default_rng(42)
    query = rng.normal(size=(5, 8))
    candidate = rng.normal(size=(7, 8))
    score = chamfer_patch_similarity(query, candidate)
    assert 0.0 <= score <= 1.0


def test_compute_local_similarity_uses_the_provider_dense_features():
    provider = DummyVisualEmbeddingProvider()
    query_bytes = make_test_image_bytes(color=(200, 40, 40))
    candidate_bytes = make_test_image_bytes(color=(200, 40, 40))
    score = compute_local_similarity(provider, query_bytes, "image/jpeg", candidate_bytes, "image/jpeg")
    assert score is not None
    assert 0.0 <= score <= 1.0


def test_compute_local_similarity_returns_none_when_provider_lacks_dense_features():
    class BareProvider:
        model_name = "bare"
        model_version = "v1"
        dimensions = 4

        def embed_image(self, image: bytes, mime_type: str) -> list[float]:
            return [0.0, 0.0, 0.0, 1.0]

    score = compute_local_similarity(
        BareProvider(), make_test_image_bytes(), "image/jpeg", make_test_image_bytes(), "image/jpeg",
    )
    assert score is None


def test_rerank_endpoint_caps_candidates_at_configured_limit(client, auth_headers):
    from app import main
    from app.config import Settings, get_settings

    capped_settings = Settings(
        visual_internal_api_key="test-internal-api-key",
        visual_local_rerank_candidates=2,
    )
    main.app.dependency_overrides[get_settings] = lambda: capped_settings

    query_b64 = base64.b64encode(make_test_image_bytes()).decode()
    request_body = {
        "query_image_base64": query_b64,
        "query_mime_type": "image/jpeg",
        "candidates": [
            {"candidate_id": "a", "image_base64": query_b64, "mime_type": "image/jpeg"},
            {"candidate_id": "b", "image_base64": query_b64, "mime_type": "image/jpeg"},
            {"candidate_id": "c", "image_base64": query_b64, "mime_type": "image/jpeg"},
        ],
    }
    response = client.post("/v1/rerank-images", json=request_body, headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["results"]) == 2


def test_rerank_endpoint_reports_local_similarity_per_candidate(client, auth_headers):
    query_b64 = base64.b64encode(make_test_image_bytes(color=(1, 2, 3))).decode()
    candidate_b64 = base64.b64encode(make_test_image_bytes(color=(4, 5, 6))).decode()
    request_body = {
        "query_image_base64": query_b64,
        "query_mime_type": "image/jpeg",
        "candidates": [
            {"candidate_id": "candidate-1", "image_base64": candidate_b64, "mime_type": "image/jpeg"},
        ],
    }
    response = client.post("/v1/rerank-images", json=request_body, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["local_rerank_available"] is True
    assert body["results"][0]["candidate_id"] == "candidate-1"
    assert 0.0 <= body["results"][0]["local_similarity"] <= 1.0
