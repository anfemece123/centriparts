"""Pydantic request/response models for every endpoint.

Kept in one module — the service is small enough that splitting per-endpoint
files would be premature structure (CLAUDE.md: avoid overengineering).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    model_version: str
    dimensions: int
    preprocessing_version: str
    model_loaded: bool


class EmbedImageRequest(BaseModel):
    image_base64: str = Field(..., description="Raw image bytes, base64-encoded.")
    mime_type: str


class EmbedImageResponse(BaseModel):
    embedding: list[float]
    provider: str
    model: str
    model_version: str
    dimensions: int
    preprocessing_version: str
    source_width: int
    source_height: int
    processed_width: int
    processed_height: int


class EmbedImagesRequest(BaseModel):
    images: list[EmbedImageRequest]


class EmbedImageItemResult(BaseModel):
    index: int
    ok: bool
    result: EmbedImageResponse | None = None
    error_code: str | None = None
    error_message: str | None = None


class EmbedImagesResponse(BaseModel):
    results: list[EmbedImageItemResult]


class RerankCandidate(BaseModel):
    candidate_id: str
    image_base64: str
    mime_type: str


class RerankImagesRequest(BaseModel):
    query_image_base64: str
    query_mime_type: str
    candidates: list[RerankCandidate]


class RerankResult(BaseModel):
    candidate_id: str
    local_similarity: float | None = Field(
        None,
        description="None when the active provider does not support dense patch features.",
    )


class RerankImagesResponse(BaseModel):
    results: list[RerankResult]
    local_rerank_available: bool


class ReadReferenceRequest(BaseModel):
    image_base64: str
    mime_type: str


class ReadReferenceResponse(BaseModel):
    raw_tokens: list[str]
    normalized_tokens: list[str]


class ErrorResponse(BaseModel):
    error: bool = True
    code: str
    message: str
