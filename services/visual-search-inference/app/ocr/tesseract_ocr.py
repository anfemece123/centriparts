"""Local OCR (spec section 17) — reads alphanumeric text (references, OEM
codes) from the query photo using Tesseract, entirely offline. Never calls
OpenAI; OpenAI OCR fallback (disabled by default) is orchestrated by the
Edge Function layer, not here.

`pytesseract` (and the `tesseract-ocr` system binary it wraps) is imported
lazily so this module — and the `OcrEngine` Protocol below — stay importable
without Tesseract installed; tests inject a fake engine instead.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Protocol

from PIL import Image

# Deliberately conservative: only real alphanumeric tokens of a plausible
# reference-code length. Never invents/completes characters that OCR
# couldn't read — a low-confidence or partial read is dropped, not guessed.
_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9\-]{2,}")


@dataclass(frozen=True)
class OcrResult:
    raw_tokens: list[str]
    normalized_tokens: list[str]


class OcrEngine(Protocol):
    def read_text(self, image: Image.Image) -> str: ...


class TesseractOcrEngine:
    def read_text(self, image: Image.Image) -> str:
        import pytesseract

        return pytesseract.image_to_string(image)


def normalize_token(token: str) -> str:
    """Uppercase + strip non-alphanumeric — the same normalization contract
    as the TypeScript `normalizeReferenceCode.ts`, so OCR output can be
    compared against CI/OEM/reference codes with the exact same rules.
    """
    return re.sub(r"[^A-Z0-9]", "", token.upper())


def read_reference_text(image_bytes: bytes, engine: OcrEngine | None = None) -> OcrResult:
    active_engine = engine or TesseractOcrEngine()

    with Image.open(io.BytesIO(image_bytes)) as opened:
        rgb = opened.convert("RGB")
        raw_text = active_engine.read_text(rgb)

    raw_tokens = _TOKEN_RE.findall(raw_text)
    normalized_tokens = [normalize_token(t) for t in raw_tokens if normalize_token(t)]

    return OcrResult(raw_tokens=raw_tokens, normalized_tokens=normalized_tokens)
