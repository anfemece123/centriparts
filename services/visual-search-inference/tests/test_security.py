from __future__ import annotations

import base64

from tests.fakes import make_test_image_bytes


def _embed_payload() -> dict:
    return {"image_base64": base64.b64encode(make_test_image_bytes()).decode(), "mime_type": "image/jpeg"}


def test_rejects_missing_api_key(client):
    response = client.post("/v1/embed-image", json=_embed_payload())
    assert response.status_code == 401


def test_rejects_wrong_api_key(client):
    response = client.post(
        "/v1/embed-image",
        json=_embed_payload(),
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert response.status_code == 401


def test_accepts_correct_api_key(client, auth_headers):
    response = client.post("/v1/embed-image", json=_embed_payload(), headers=auth_headers)
    assert response.status_code == 200


def test_health_is_reachable_without_a_key(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_error_responses_never_leak_stack_traces(client, auth_headers):
    response = client.post(
        "/v1/embed-image",
        json={"image_base64": "not-valid-base64!!!", "mime_type": "image/jpeg"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"] is True
    assert "Traceback" not in str(body)
    assert "/app/" not in str(body)
