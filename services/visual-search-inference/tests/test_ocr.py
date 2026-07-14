from __future__ import annotations

import base64

from app.ocr.tesseract_ocr import OcrResult, normalize_token, read_reference_text
from tests.fakes import DummyOcrEngine, make_test_image_bytes


def test_extracts_and_normalizes_alphanumeric_tokens():
    engine = DummyOcrEngine(text="Ref-1234 abc !! xy")
    result = read_reference_text(make_test_image_bytes(), engine=engine)
    assert "REF1234" in result.normalized_tokens
    # "xy" (2 chars) is below the minimum token length and is dropped;
    # downstream matching (not this module) is what decides whether a short
    # generic token like "abc" may count as a confident reference match.
    assert "XY" not in result.normalized_tokens
    assert result.raw_tokens  # original casing/punctuation preserved separately


def test_does_not_invent_or_complete_illegible_characters():
    # The normalizer must be a pure pass-through: it never "corrects" or
    # completes a token, it only uppercases and strips punctuation.
    assert normalize_token("ab-12??") == "AB12"
    assert normalize_token("") == ""


def test_short_noise_tokens_are_still_reported_raw_but_ocr_never_invents_new_ones():
    engine = DummyOcrEngine(text="a 1 !!")
    result = read_reference_text(make_test_image_bytes(), engine=engine)
    # Nothing invented beyond what the engine actually returned.
    assert all(token in engine.text for token in result.raw_tokens)


def test_read_reference_endpoint_returns_tokens(client, auth_headers, monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "read_reference_text",
        lambda image_bytes: OcrResult(raw_tokens=["REF-999"], normalized_tokens=["REF999"]),
    )

    response = client.post(
        "/v1/read-reference",
        json={"image_base64": base64.b64encode(make_test_image_bytes()).decode(), "mime_type": "image/jpeg"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["normalized_tokens"] == ["REF999"]


def test_read_reference_endpoint_disabled_returns_empty_result(client, auth_headers):
    from app import main
    from app.config import Settings, get_settings

    disabled_settings = Settings(visual_internal_api_key="test-internal-api-key", visual_ocr_enabled=False)
    main.app.dependency_overrides[get_settings] = lambda: disabled_settings

    response = client.post(
        "/v1/read-reference",
        json={"image_base64": base64.b64encode(make_test_image_bytes()).decode(), "mime_type": "image/jpeg"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["raw_tokens"] == []
    assert body["normalized_tokens"] == []
