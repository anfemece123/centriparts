# visual-search-inference

Independent inference service for Centriparts' image-against-image visual
search. Generates embeddings **directly from pixels** (never from text/OpenAI
descriptions), does local (non-OpenAI) visual reranking, and reads reference
codes with local OCR. Called only by Supabase Edge Functions over a private
network path — **never exposed to the browser**.

## Why a separate service instead of a Supabase Edge Function

Edge Functions run on Deno with tight memory/CPU/time limits, and have no
way to load a PyTorch/ONNX model or a native OCR binary. This is a small
FastAPI container instead — deployable to any Docker host (Fly.io, Render,
Railway, a VPS, Cloud Run, etc.).

## Model choice

**Initial active provider: DINOv2 (`facebook/dinov2-small`, 384-dim).**

DINOv2 is self-supervised at the patch level — it was never trained to align
images with text/category labels. That matters here specifically: this
ticket needs to recognize *the same physical part* across different photos
(dirty, rotated, different background, partial view), not just "something
visually similar". Text-aligned models (CLIP/SigLIP family) tend to cluster
images by *semantic category* — two different-but-similar-looking parts of
the same category can end up closer together than two photos of the exact
same part taken under different conditions, which is the opposite of what a
parts-identification search needs.

`SigLIP` (`google/siglip-base-patch16-224`, 768-dim) is implemented as a
second, fully interchangeable provider behind the same `VisualEmbeddingProvider`
Protocol (see `app/embeddings/__init__.py`), to satisfy the requirement of
evaluating at least two model families and to make swapping providers a
config change, not a code change. **This is not asserted to be the better
model — it's the reasonable initial default given the constraints below.**
Switching the active provider is `VISUAL_EMBEDDING_PROVIDER=siglip` plus the
matching `VISUAL_EMBEDDING_MODEL`/`VISUAL_EMBEDDING_DIMENSIONS`, followed by
a bump of `VISUAL_EMBEDDING_VERSION` (which triggers reprocessing, since the
dimensions differ and the pgvector column has a fixed dimension — see the
migration comments).

Local reranking (`app/reranking/local_rerank.py`) reuses DINOv2's own dense
patch tokens (a "Chamfer"-style nearest-patch similarity) instead of a third
model — this rewards shared local structure (connectors, holes, mounting
points) even when the overall silhouette/background differs.

### What has NOT been verified in this repository

This service was built in a sandbox without Docker and without a reliable
way to download and run multi-hundred-MB model weights. Concretely:

- `pytest`/`ruff`/`mypy` **were actually run** (see command below) — but only
  against `requirements-test.txt` (no `torch`/`transformers`/`pytesseract`),
  using a `DummyVisualEmbeddingProvider`/`DummyOcrEngine` injected via
  FastAPI dependency overrides (`tests/fakes.py`).
- The real DINOv2/SigLIP providers (`dinov2_provider.py`, `siglip_provider.py`)
  and the real Tesseract OCR engine (`tesseract_ocr.py`) are written and
  code-reviewed but **not yet run against real model weights or a real
  `tesseract` binary**. `docker build` was not run either (Docker isn't
  available in the environment this was built in).
- Running the real evaluation harness (`scripts/visual-eval` in the main
  repo) against real photos, and picking a final model based on measured
  Recall@K/MRR rather than this written rationale, is still pending — see
  the main repository's final report for the exact commands.

## Endpoints

All endpoints except `/health` require `X-Internal-Api-Key` (constant-time
compared against `VISUAL_INTERNAL_API_KEY`) and are best-effort rate-limited
per client IP.

- `GET /health` — cheap liveness probe; reports the configured
  provider/model/version/dimensions without forcing a model load.
- `POST /v1/embed-image` — `{ image_base64, mime_type }` → embedding vector +
  preprocessing metadata (source/processed width/height).
- `POST /v1/embed-images` — batch version, capped at `VISUAL_MAX_BATCH_SIZE`;
  a single bad image returns a per-item error without failing the batch.
- `POST /v1/rerank-images` — `{ query_image_base64, query_mime_type, candidates[] }`
  → per-candidate local similarity score, capped at
  `VISUAL_LOCAL_RERANK_CANDIDATES`. Returns `local_rerank_available: false`
  if the active provider has no dense-feature support (never errors).
- `POST /v1/read-reference` — local OCR; returns raw + normalized tokens.
  Never completes/guesses illegible characters. Returns an empty result
  (not an error) when `VISUAL_OCR_ENABLED=false`.

## Configuration

See `.env.example`. Every value has a safe default except
`VISUAL_INTERNAL_API_KEY`, which must be set (generate with
`openssl rand -hex 32`) — requests fail closed if it's missing.

## Running locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # full stack, includes torch/transformers
cp .env.example .env              # set VISUAL_INTERNAL_API_KEY
uvicorn app.main:app --reload
```

## Running the test suite (lightweight, no torch/transformers/tesseract)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-test.txt
pytest -q
ruff check .
mypy app tests
```

This is exactly what was run while building this service (31 tests, all
passing; ruff and mypy both clean).

## Building and deploying the Docker image

```bash
docker build -t centriparts-visual-search-inference .
docker run -p 8000:8000 --env-file .env centriparts-visual-search-inference
```

Deploy the built image to any container host. Example using Fly.io
(illustrative — any Docker host works identically):

```bash
fly launch --dockerfile Dockerfile --no-deploy
fly secrets set VISUAL_INTERNAL_API_KEY=$(openssl rand -hex 32)
fly deploy
```

Then set `VISUAL_INFERENCE_SERVICE_URL` and `VISUAL_INFERENCE_API_KEY` as
Supabase secrets so the Edge Functions can reach it (see the main
repository's final report for the exact `supabase secrets set` command).
