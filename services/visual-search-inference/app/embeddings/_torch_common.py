"""Shared tensor-conversion helpers for torch/transformers-based providers.

Split out so dinov2_provider.py and siglip_provider.py don't duplicate the
same preprocessing→tensor glue. Still lazily imports torch — importing this
module itself only imports numpy/PIL, the actual `torch` import happens
inside `to_normalized_tensor` at call time via the `torch_module` argument
the caller already imported.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class EmbeddingDimensionMismatchError(RuntimeError):
    """Raised when the model's real output size doesn't match configured
    VISUAL_EMBEDDING_DIMENSIONS — better to fail loudly than silently
    truncate/pad a vector, which would corrupt cosine similarity.
    """


def to_normalized_tensor(torch_module, image: Image.Image):
    """PIL RGB image (already resized/letterboxed by preprocessing.py) →
    a (1, 3, H, W) float tensor, ImageNet-normalized. Deterministic: no
    random augmentation.
    """
    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - _IMAGENET_MEAN) / _IMAGENET_STD
    chw = array.transpose(2, 0, 1)
    return torch_module.from_numpy(chw).unsqueeze(0).float()


def l2_normalize(torch_module, vector):
    norm = vector.norm(p=2)
    if float(norm) == 0.0:
        return vector
    return vector / norm


def assert_dimensions(vector_len: int, expected: int, model_name: str) -> None:
    if vector_len != expected:
        raise EmbeddingDimensionMismatchError(
            f"model {model_name!r} produced a {vector_len}-dim vector, "
            f"but VISUAL_EMBEDDING_DIMENSIONS is configured as {expected}. "
            "Fix the config instead of silently truncating/padding the vector.",
        )
