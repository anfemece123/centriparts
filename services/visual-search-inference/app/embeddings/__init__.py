"""Interchangeable visual embedding providers.

`VisualEmbeddingProvider` is the exact contract from the spec — any model
family can be swapped in behind it via config, and the active
provider/model/version/dimensions are always stamped onto the stored vector
(see supabase/migrations/20260407000000_visual_pixel_embeddings.sql) so
vectors from different model families are never compared against each other.

Concrete providers (dinov2_provider.py, siglip_provider.py) import
torch/transformers lazily, inside their constructors — importing this
package, or building a `DummyVisualEmbeddingProvider` for tests, never
requires those heavy dependencies to be installed.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

import numpy as np

if TYPE_CHECKING:
    from app.config import Settings


@runtime_checkable
class VisualEmbeddingProvider(Protocol):
    model_name: str
    model_version: str
    dimensions: int

    def embed_image(self, image: bytes, mime_type: str) -> list[float]:
        """Preprocesses and embeds a single raw image into a unit-norm vector."""
        ...


@runtime_checkable
class DensePatchProvider(Protocol):
    """Optional extra capability: dense per-patch features for local
    reranking (spec section 16). Not every provider needs to implement this
    — `local_rerank.py` checks with `isinstance(provider, DensePatchProvider)`
    and skips local reranking gracefully if it's unavailable.
    """

    def dense_patch_features(self, image: bytes, mime_type: str) -> np.ndarray:
        """Returns an (num_patches, patch_dim) array of dense local features."""
        ...


def create_provider(settings: Settings) -> VisualEmbeddingProvider:
    """Factory — the only place that imports a concrete provider module, so
    only the actually-configured provider ever triggers a torch import.
    """
    if settings.visual_embedding_provider == "dinov2":
        from app.embeddings.dinov2_provider import DinoV2Provider

        return DinoV2Provider(settings)
    if settings.visual_embedding_provider == "siglip":
        from app.embeddings.siglip_provider import SigLipProvider

        return SigLipProvider(settings)
    raise ValueError(f"unknown VISUAL_EMBEDDING_PROVIDER: {settings.visual_embedding_provider!r}")
