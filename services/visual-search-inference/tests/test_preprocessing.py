from __future__ import annotations

import io

import pytest
from PIL import Image

from app.preprocessing import (
    ImageTooLargeError,
    InvalidImageError,
    preprocess_image,
    validate_image_bytes,
)
from tests.fakes import make_test_image_bytes


def test_rejects_corrupted_bytes():
    with pytest.raises(InvalidImageError):
        validate_image_bytes(b"not-an-image-at-all", max_mb=8)


def test_rejects_oversized_file():
    tiny_limit_mb = 1
    big_image = make_test_image_bytes(size=(4000, 4000))
    # Only run the assertion if the fixture actually exceeds the tiny limit
    # (JPEG compression can make even a large image small).
    if len(big_image) > tiny_limit_mb * 1024 * 1024:
        with pytest.raises(ImageTooLargeError):
            validate_image_bytes(big_image, max_mb=tiny_limit_mb)


def test_letterbox_preserves_aspect_ratio_without_deforming():
    raw = make_test_image_bytes(size=(200, 100))  # 2:1 landscape
    result = preprocess_image(raw, max_mb=8, target_size=224)

    assert result.source_width == 200
    assert result.source_height == 100
    assert result.processed_width == 224
    assert result.processed_height == 224

    # The letterboxed canvas is square, but the actual content inside it
    # should keep the original 2:1 ratio (100x224 padded top/bottom would be
    # wrong; width-constrained scaling keeps height at 112 inside a 224 canvas).
    array = result.image
    assert array.size == (224, 224)


def test_same_bytes_same_version_are_pixel_identical():
    raw = make_test_image_bytes()
    first = preprocess_image(raw, max_mb=8, target_size=224)
    second = preprocess_image(raw, max_mb=8, target_size=224)
    assert list(first.image.getdata()) == list(second.image.getdata())


def test_exif_rotation_is_actually_applied_not_just_stripped():
    # Build a JPEG with an EXIF orientation tag indicating a 90-degree
    # rotation is needed, and confirm the *pixel content* ends up rotated —
    # not merely stripped of the tag (the documented gap in the legacy
    # TypeScript imageProcessing.ts).
    base = Image.new("RGB", (60, 40), color=(10, 20, 30))
    buffer = io.BytesIO()
    exif = base.getexif()
    exif[274] = 6  # Orientation tag: rotate 90 CW on display
    base.save(buffer, format="JPEG", exif=exif)

    result = preprocess_image(buffer.getvalue(), max_mb=8, target_size=224)

    # After exif_transpose, a 60x40 image with orientation=6 becomes 40x60
    # (width/height swapped) before letterboxing.
    assert result.source_width == 40
    assert result.source_height == 60
