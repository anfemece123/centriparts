"""Test doubles — no torch/transformers/tesseract required to run the suite.

Mirrors the "inject a fake port" pattern already used on the TypeScript side
(supabase/functions/_shared/*.test.ts): every stateful/heavy dependency is a
small interface, and tests provide a deterministic fake instead of the real
one.
"""

from __future__ import annotations

import hashlib

import numpy as np
from PIL import Image


class DummyVisualEmbeddingProvider:
    """Deterministic, hash-based pseudo-embedding — same bytes always
    produce the same vector, different bytes (almost always) differ, and no
    ML framework is involved.
    """

    model_name = "dummy-test-model"
    model_version = "test"
    dimensions = 16

    def embed_image(self, image: bytes, mime_type: str) -> list[float]:
        digest = hashlib.sha256(image).digest()
        raw = np.frombuffer((digest * 2)[: self.dimensions], dtype=np.uint8).astype(np.float32)
        norm = np.linalg.norm(raw)
        if norm == 0:
            return raw.tolist()
        return (raw / norm).tolist()

    def dense_patch_features(self, image: bytes, mime_type: str) -> np.ndarray:
        digest = hashlib.sha256(image).digest()
        patch_dim = 8
        num_patches = 4
        raw = np.frombuffer((digest * 4)[: num_patches * patch_dim], dtype=np.uint8)
        patches = raw.reshape(num_patches, patch_dim).astype(np.float32)
        norms = np.linalg.norm(patches, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return patches / norms


class DummyOcrEngine:
    """Returns fixed text regardless of the image — good enough to test
    tokenization/normalization without a real tesseract binary.
    """

    def __init__(self, text: str = "REF-1234 ABC") -> None:
        self.text = text

    def read_text(self, image: Image.Image) -> str:
        return self.text


def make_test_image_bytes(
    color: tuple[int, int, int] = (200, 40, 40),
    size: tuple[int, int] = (64, 96),
) -> bytes:
    import io

    image = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()
