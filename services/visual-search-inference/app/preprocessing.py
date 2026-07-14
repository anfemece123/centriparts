"""Deterministic, versioned image preprocessing (spec section 8).

Pure PIL/numpy — no ML framework dependency here, so this module (and its
tests) never need torch/transformers installed. Every embedding provider
calls this same pipeline, so "same image + same preprocessing version" always
produces the same normalized input regardless of which model embeds it.

Real EXIF-orientation rotation (not just stripping the tag, which is what the
existing TypeScript `imageProcessing.ts` documents as a known gap) — Pillow
can decode and re-encode pixels, so it can actually rotate the image.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps

# Real magic-byte signatures — never trust the client-supplied MIME type.
_SIGNATURES: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",  # WEBP has "WEBP" at offset 8, checked separately.
}


class InvalidImageError(ValueError):
    """Raised when the input is not a valid, decodable image."""


class ImageTooLargeError(ValueError):
    """Raised when the input exceeds VISUAL_MAX_IMAGE_MB."""


@dataclass(frozen=True)
class PreprocessedImage:
    image: Image.Image
    source_width: int
    source_height: int
    processed_width: int
    processed_height: int


def _detect_real_format(raw_bytes: bytes) -> str | None:
    if raw_bytes.startswith(_SIGNATURES["image/jpeg"]):
        return "image/jpeg"
    if raw_bytes.startswith(_SIGNATURES["image/png"]):
        return "image/png"
    if raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image_bytes(raw_bytes: bytes, max_mb: int) -> str:
    """Validates size and real file format. Returns the detected MIME type."""
    max_bytes = max_mb * 1024 * 1024
    if len(raw_bytes) == 0:
        raise InvalidImageError("empty file")
    if len(raw_bytes) > max_bytes:
        raise ImageTooLargeError(f"file exceeds {max_mb}MB limit")

    detected = _detect_real_format(raw_bytes)
    if detected is None:
        raise InvalidImageError("unrecognized or corrupted image format")

    try:
        with Image.open(io.BytesIO(raw_bytes)) as probe:
            probe.verify()
    except Exception as exc:  # Pillow raises a variety of exception types.
        raise InvalidImageError(f"corrupted image: {exc}") from exc

    return detected


def preprocess_image(raw_bytes: bytes, max_mb: int, target_size: int) -> PreprocessedImage:
    """Validate → EXIF-correct rotation → RGB → strip metadata → letterbox resize.

    Deterministic: the same bytes + the same `target_size` always produce
    pixel-identical output. Never deforms the aspect ratio (letterbox padding
    instead), which preserves connector/hole/mounting proportions that a
    naive stretch-to-square resize would distort.
    """
    validate_image_bytes(raw_bytes, max_mb)

    with Image.open(io.BytesIO(raw_bytes)) as opened:
        # Re-opening after verify() (verify() leaves the file unusable for
        # further operations) and applying real EXIF-orientation rotation.
        oriented = ImageOps.exif_transpose(opened)
        if oriented is None:
            oriented = opened
        source_width, source_height = oriented.size

        rgb = oriented.convert("RGB")

        # Re-creating a fresh Image via putdata-free copy() strips any
        # remaining metadata (EXIF/ICC/comments) that convert() may retain.
        clean = Image.new("RGB", rgb.size)
        clean.putdata(list(rgb.getdata()))

        letterboxed = _resize_with_letterbox(clean, target_size)

    return PreprocessedImage(
        image=letterboxed,
        source_width=source_width,
        source_height=source_height,
        processed_width=letterboxed.width,
        processed_height=letterboxed.height,
    )


def _resize_with_letterbox(image: Image.Image, target_size: int) -> Image.Image:
    width, height = image.size
    scale = min(target_size / width, target_size / height)
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))

    resized = image.resize((new_width, new_height), Image.Resampling.BICUBIC)

    canvas = Image.new("RGB", (target_size, target_size), color=(0, 0, 0))
    offset = ((target_size - new_width) // 2, (target_size - new_height) // 2)
    canvas.paste(resized, offset)
    return canvas
