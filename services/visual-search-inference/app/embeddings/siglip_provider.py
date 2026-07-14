"""SigLIP provider — the second model family required by spec section 6 for
a real comparison against DINOv2. Text-image aligned (contrastive) model;
included here mainly as the evaluation baseline that section 6 explicitly
requires ("evalúa al menos dos familias apropiadas"), not as the default.

See README for why DINOv2 is the initial active provider instead: SigLIP's
image tower is optimized to align with captions/categories, which tends to
group visually-different-but-same-category parts together — exactly what
this ticket's "same physical part, not just similar" requirement warns
against. Kept fully interchangeable behind the same Protocol so switching
providers is a config change, not a code change.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.config import Settings
from app.embeddings._torch_common import assert_dimensions, l2_normalize, to_normalized_tensor
from app.preprocessing import preprocess_image


class SigLipProvider:
    def __init__(self, settings: Settings) -> None:
        self.model_name = settings.visual_embedding_model
        self.model_version = settings.visual_embedding_version
        self.dimensions = settings.visual_embedding_dimensions
        self._max_mb = settings.visual_max_image_mb
        self._input_size = settings.visual_normalized_image_size
        self._model: Any = None
        self._torch: Any = None

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        import torch
        from transformers import SiglipVisionModel

        self._torch = torch
        model = SiglipVisionModel.from_pretrained(self.model_name)
        model.eval()
        self._model = model

    def embed_image(self, image: bytes, mime_type: str) -> list[float]:
        self._ensure_loaded()
        pre = preprocess_image(image, max_mb=self._max_mb, target_size=self._input_size)
        tensor = to_normalized_tensor(self._torch, pre.image)

        with self._torch.no_grad():
            output = self._model(pixel_values=tensor)

        pooled = output.pooler_output.squeeze(0)
        normalized = l2_normalize(self._torch, pooled)
        vector = normalized.tolist()
        assert_dimensions(len(vector), self.dimensions, self.model_name)
        return vector

    def dense_patch_features(self, image: bytes, mime_type: str) -> np.ndarray:
        """SigLIP has no CLS token — every token in last_hidden_state is a
        patch, unlike DINOv2 where the first token must be dropped.
        """
        self._ensure_loaded()
        pre = preprocess_image(image, max_mb=self._max_mb, target_size=self._input_size)
        tensor = to_normalized_tensor(self._torch, pre.image)

        with self._torch.no_grad():
            output = self._model(pixel_values=tensor)

        patch_tokens = output.last_hidden_state.squeeze(0)
        norms = patch_tokens.norm(p=2, dim=-1, keepdim=True)
        norms = self._torch.clamp(norms, min=1e-12)
        normalized = patch_tokens / norms
        return normalized.numpy()
