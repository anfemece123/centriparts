from __future__ import annotations


def test_health_requires_no_auth_and_reports_active_config(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"]
    assert body["model"]
    assert "dimensions" in body
    assert "preprocessing_version" in body


def test_health_never_triggers_a_model_load(client):
    response = client.get("/health")
    assert response.status_code == 200
    # A health probe must stay cheap/fast — it must not force a heavy model
    # download/load just to answer "am I up".
    assert response.json()["model_loaded"] is False
