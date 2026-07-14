"""Local (non-OpenAI) visual reranking — spec section 16.

Compares dense per-patch features between the query photo and one candidate
image using a symmetric nearest-patch ("Chamfer-style") similarity: for every
query patch, find its best-matching candidate patch (and vice versa), then
average. This rewards parts that share local structure — connectors, holes,
mounting points, curvatures — even when the overall silhouette or background
differs, without training a dedicated pairwise comparison model.

Only ever called with the query image plus one (or optionally two) already
category-scoped candidate images — never the whole catalog, and never one
model call per candidate (a single dense-feature extraction per image, then
cheap numpy comparisons).
"""

from __future__ import annotations

import numpy as np

from app.embeddings import DensePatchProvider, VisualEmbeddingProvider


def chamfer_patch_similarity(query_patches: np.ndarray, candidate_patches: np.ndarray) -> float:
    """query_patches, candidate_patches: (N, D) and (M, D) L2-normalized rows.
    Returns a similarity in [0, 1] (cosine similarities are in [-1, 1] for
    generic vectors, but non-negative activations from these models keep it
    close to [0, 1] in practice; clamped defensively below).
    """
    if query_patches.size == 0 or candidate_patches.size == 0:
        return 0.0

    similarity_matrix = query_patches @ candidate_patches.T  # (N, M)

    query_to_candidate = similarity_matrix.max(axis=1).mean()
    candidate_to_query = similarity_matrix.max(axis=0).mean()

    score = float((query_to_candidate + candidate_to_query) / 2.0)
    return max(0.0, min(1.0, score))


def compute_local_similarity(
    provider: VisualEmbeddingProvider,
    query_image: bytes,
    query_mime_type: str,
    candidate_image: bytes,
    candidate_mime_type: str,
) -> float | None:
    """Returns None (never raises) when the active provider doesn't expose
    dense patch features — callers must treat that as "local rerank
    unavailable" and fall back to global similarity only, not as an error.
    """
    if not isinstance(provider, DensePatchProvider):
        return None

    query_patches = provider.dense_patch_features(query_image, query_mime_type)
    candidate_patches = provider.dense_patch_features(candidate_image, candidate_mime_type)
    return chamfer_patch_similarity(query_patches, candidate_patches)
