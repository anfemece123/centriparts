"""DINOv2 provider — the initial default (see README for the comparison
against SigLIP). Self-supervised, patch-level ViT features: separates
*instances* (this exact part vs. a visually-similar different part) rather
than just *categories* the way text-aligned models (CLIP/SigLIP) tend to,
which is the property this ticket actually needs.

torch/transformers are imported lazily inside `_ensure_loaded`, so importing
this module — or even constructing this class — without ever calling
`embed_image`/`dense_patch_features` never requires those packages to be
installed. This keeps `app.embeddings` importable (and unit-testable via the
Protocol alone) in environments without a full ML stack.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.config import Settings
from app.embeddings._torch_common import assert_dimensions, l2_normalize, to_normalized_tensor
from app.preprocessing import preprocess_image


class DinoV2Provider:
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
        from transformers import AutoModel

        self._torch = torch
        model = AutoModel.from_pretrained(self.model_name)
        model.eval()
        self._model = model

    def embed_image(self, image: bytes, mime_type: str) -> list[float]:
        self._ensure_loaded()
        pre = preprocess_image(image, max_mb=self._max_mb, target_size=self._input_size)
        tensor = to_normalized_tensor(self._torch, pre.image)

        with self._torch.no_grad():
            output = self._model(pixel_values=tensor)

        cls_token = output.last_hidden_state[:, 0, :].squeeze(0)
        normalized = l2_normalize(self._torch, cls_token)
        vector = normalized.tolist()
        assert_dimensions(len(vector), self.dimensions, self.model_name)
        return vector

    def dense_patch_features(self, image: bytes, mime_type: str) -> np.ndarray:
        """Patch tokens (excludes the CLS token) — used by local_rerank.py
        for part-level (connectors/holes/mounting) comparison, spec section 16.
        """
        self._ensure_loaded()
        pre = preprocess_image(image, max_mb=self._max_mb, target_size=self._input_size)
        tensor = to_normalized_tensor(self._torch, pre.image)

        with self._torch.no_grad():
            output = self._model(pixel_values=tensor)

        patch_tokens = output.last_hidden_state[:, 1:, :].squeeze(0)
        norms = patch_tokens.norm(p=2, dim=-1, keepdim=True)
        norms = self._torch.clamp(norms, min=1e-12)
        normalized = patch_tokens / norms
        return normalized.numpy()
