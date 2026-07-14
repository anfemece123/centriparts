from __future__ import annotations

import base64

from tests.fakes import DummyVisualEmbeddingProvider, make_test_image_bytes


def _payload(color=(200, 40, 40)) -> dict:
    encoded = base64.b64encode(make_test_image_bytes(color=color)).decode()
    return {"image_base64": encoded, "mime_type": "image/jpeg"}


def test_embed_image_returns_a_vector_with_the_configured_dimensions(client, auth_headers):
    response = client.post("/v1/embed-image", json=_payload(), headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == DummyVisualEmbeddingProvider.dimensions
    assert body["model"] == DummyVisualEmbeddingProvider.model_name
    assert body["processed_width"] > 0 and body["processed_height"] > 0


def test_embed_image_never_returns_the_source_bytes_or_base64(client, auth_headers):
    response = client.post("/v1/embed-image", json=_payload(), headers=auth_headers)
    body = response.json()
    assert "image_base64" not in body
    assert "raw_bytes" not in body


def test_same_image_produces_the_same_embedding(client, auth_headers):
    payload = _payload()
    first = client.post("/v1/embed-image", json=payload, headers=auth_headers).json()
    second = client.post("/v1/embed-image", json=payload, headers=auth_headers).json()
    assert first["embedding"] == second["embedding"]


def test_different_images_produce_different_embeddings(client, auth_headers):
    a = client.post("/v1/embed-image", json=_payload(color=(200, 40, 40)), headers=auth_headers).json()
    b = client.post("/v1/embed-image", json=_payload(color=(10, 200, 10)), headers=auth_headers).json()
    assert a["embedding"] != b["embedding"]


def test_embed_images_batch_isolates_a_bad_item_from_the_rest(client, auth_headers):
    request_body = {
        "images": [
            _payload(),
            {"image_base64": "not-valid-base64!!!", "mime_type": "image/jpeg"},
            _payload(color=(5, 5, 200)),
        ],
    }
    response = client.post("/v1/embed-images", json=request_body, headers=auth_headers)
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["ok"] is True
    assert results[1]["ok"] is False
    assert results[1]["error_code"] == "invalid_file"
    assert results[2]["ok"] is True


def test_embed_images_batch_is_capped_at_the_configured_max_size(client, auth_headers, monkeypatch):
    from app import main
    from app.config import Settings, get_settings

    capped_settings = Settings(
        visual_internal_api_key="test-internal-api-key",
        visual_max_batch_size=2,
    )
    main.app.dependency_overrides[get_settings] = lambda: capped_settings

    request_body = {"images": [_payload(), _payload(), _payload()]}
    response = client.post("/v1/embed-images", json=request_body, headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["results"]) == 2


def test_oversized_file_is_rejected_with_413(client, auth_headers):
    huge_base64 = "A" * (20 * 1024 * 1024)
    response = client.post(
        "/v1/embed-image",
        json={"image_base64": huge_base64, "mime_type": "image/jpeg"},
        headers=auth_headers,
    )
    assert response.status_code == 413
