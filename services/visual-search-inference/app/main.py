"""Visual search inference service — FastAPI entrypoint.

Never exposed to the browser (spec sections 5/27): only the Supabase Edge
Functions call this, over a private network path, authenticated with
`X-Internal-Api-Key`. Never persists images, never logs base64/full vectors.
"""

from __future__ import annotations

import base64
import binascii
import logging
import time

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.embeddings import VisualEmbeddingProvider, create_provider
from app.ocr.tesseract_ocr import read_reference_text
from app.preprocessing import ImageTooLargeError, InvalidImageError, preprocess_image
from app.reranking.local_rerank import compute_local_similarity
from app.schemas import (
    EmbedImageItemResult,
    EmbedImageRequest,
    EmbedImageResponse,
    EmbedImagesRequest,
    EmbedImagesResponse,
    HealthResponse,
    ReadReferenceRequest,
    ReadReferenceResponse,
    RerankImagesRequest,
    RerankImagesResponse,
    RerankResult,
)
from app.security import enforce_rate_limit, verify_api_key

logger = logging.getLogger("visual_search_inference")

app = FastAPI(title="Centriparts Visual Search Inference", version="1.0.0")

_provider_singleton: VisualEmbeddingProvider | None = None


def get_provider(settings: Settings = Depends(get_settings)) -> VisualEmbeddingProvider:
    global _provider_singleton
    if _provider_singleton is None:
        _provider_singleton = create_provider(settings)
    return _provider_singleton


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - started) * 1000, 1)
    # Safe fields only — never the request/response body (would leak
    # base64 images or embeddings into logs).
    logger.info(
        "request",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


def _decode_image(image_base64: str, max_mb: int) -> bytes:
    # Reject grossly oversized base64 payloads before the (more expensive)
    # decode step. Base64 inflates size by ~4/3.
    if len(image_base64) > max_mb * 1024 * 1024 * 2:
        raise ImageTooLargeError(f"file exceeds {max_mb}MB limit")
    try:
        return base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImageError("invalid base64 payload") from exc


def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": True, "code": code, "message": message})


@app.exception_handler(InvalidImageError)
async def handle_invalid_image(_request: Request, exc: InvalidImageError) -> JSONResponse:
    return _error_response("invalid_file", str(exc), 400)


@app.exception_handler(ImageTooLargeError)
async def handle_too_large(_request: Request, exc: ImageTooLargeError) -> JSONResponse:
    return _error_response("file_too_large", str(exc), 413)


@app.exception_handler(Exception)
async def handle_unexpected(_request: Request, exc: Exception) -> JSONResponse:
    # Never leak stack traces / internal paths in the response; log safely
    # server-side only (exception type + message, no payload contents).
    logger.error("unexpected_error", extra={"exception_type": type(exc).__name__})
    return _error_response("unexpected_error", "internal error", 500)


@app.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        provider=settings.visual_embedding_provider,
        model=settings.visual_embedding_model,
        model_version=settings.visual_embedding_version,
        dimensions=settings.visual_embedding_dimensions,
        preprocessing_version=settings.visual_preprocessing_version,
        model_loaded=_provider_singleton is not None,
    )


def _embed_one(
    req: EmbedImageRequest,
    provider: VisualEmbeddingProvider,
    settings: Settings,
) -> EmbedImageResponse:
    raw_bytes = _decode_image(req.image_base64, settings.visual_max_image_mb)
    pre = preprocess_image(raw_bytes, settings.visual_max_image_mb, settings.visual_normalized_image_size)
    embedding = provider.embed_image(raw_bytes, req.mime_type)
    return EmbedImageResponse(
        embedding=embedding,
        provider=settings.visual_embedding_provider,
        model=provider.model_name,
        model_version=provider.model_version,
        dimensions=provider.dimensions,
        preprocessing_version=settings.visual_preprocessing_version,
        source_width=pre.source_width,
        source_height=pre.source_height,
        processed_width=pre.processed_width,
        processed_height=pre.processed_height,
    )


@app.post(
    "/v1/embed-image",
    response_model=EmbedImageResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
def embed_image(
    req: EmbedImageRequest,
    provider: VisualEmbeddingProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> EmbedImageResponse:
    return _embed_one(req, provider, settings)


@app.post(
    "/v1/embed-images",
    response_model=EmbedImagesResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
def embed_images(
    req: EmbedImagesRequest,
    provider: VisualEmbeddingProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> EmbedImagesResponse:
    capped = req.images[: settings.visual_max_batch_size]
    results: list[EmbedImageItemResult] = []
    for index, item in enumerate(capped):
        try:
            embedded = _embed_one(item, provider, settings)
            results.append(EmbedImageItemResult(index=index, ok=True, result=embedded))
        except InvalidImageError as exc:
            results.append(
                EmbedImageItemResult(
                    index=index, ok=False, error_code="invalid_file", error_message=str(exc)[:200],
                ),
            )
        except ImageTooLargeError as exc:
            results.append(
                EmbedImageItemResult(
                    index=index, ok=False, error_code="file_too_large", error_message=str(exc)[:200],
                ),
            )
        except Exception as exc:  # A single bad image must not fail the whole batch.
            logger.error("embed_images_item_failed", extra={"exception_type": type(exc).__name__})
            results.append(
                EmbedImageItemResult(
                    index=index, ok=False, error_code="unexpected_error", error_message="internal error",
                ),
            )
    return EmbedImagesResponse(results=results)


@app.post(
    "/v1/rerank-images",
    response_model=RerankImagesResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
def rerank_images(
    req: RerankImagesRequest,
    provider: VisualEmbeddingProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> RerankImagesResponse:
    query_bytes = _decode_image(req.query_image_base64, settings.visual_max_image_mb)
    candidates = req.candidates[: settings.visual_local_rerank_candidates]

    results: list[RerankResult] = []
    local_rerank_available = True
    for candidate in candidates:
        candidate_bytes = _decode_image(candidate.image_base64, settings.visual_max_image_mb)
        similarity = compute_local_similarity(
            provider, query_bytes, req.query_mime_type, candidate_bytes, candidate.mime_type,
        )
        if similarity is None:
            local_rerank_available = False
        results.append(RerankResult(candidate_id=candidate.candidate_id, local_similarity=similarity))

    return RerankImagesResponse(results=results, local_rerank_available=local_rerank_available)


@app.post(
    "/v1/read-reference",
    response_model=ReadReferenceResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
def read_reference(
    req: ReadReferenceRequest,
    settings: Settings = Depends(get_settings),
) -> ReadReferenceResponse:
    if not settings.visual_ocr_enabled:
        return ReadReferenceResponse(raw_tokens=[], normalized_tokens=[])

    image_bytes = _decode_image(req.image_base64, settings.visual_max_image_mb)
    result = read_reference_text(image_bytes)
    return ReadReferenceResponse(raw_tokens=result.raw_tokens, normalized_tokens=result.normalized_tokens)
