-- ============================================================
-- Visual pixel embeddings (image-against-image visual search)
-- ============================================================
--
-- Adds a second, independent embedding pipeline that sits next to the
-- existing OpenAI text-embedding pipeline (product_image_ai_features,
-- 20260406000000_visual_search.sql), which is NOT modified or dropped by
-- this migration — it stays available as a legacy fallback until the new
-- pipeline is validated (see VISUAL_SEARCH_ENGINE in the Edge Functions).
--
-- The new pipeline stores embeddings generated directly from image pixels
-- (DINOv2/SigLIP-family models served by services/visual-search-inference),
-- never from text, and never involves OpenAI in indexing.
--
-- Adds:
--   - product_image_visual_embeddings: one row per (product_image, provider,
--     model, model_version, preprocessing_version) holding the pixel-based
--     embedding and its job status.
--   - visual_embedding_active_config: singleton row mirroring the currently
--     active VISUAL_EMBEDDING_* env vars, kept in sync by the worker Edge
--     Function on every run. Lets the auto-enqueue trigger stamp new jobs
--     with the real active model without duplicating env vars in SQL.
--   - enqueue_visual_embedding_job(): trigger function that creates (or
--     resets) a pending job whenever a product image is inserted, or an
--     existing image's storage_path changes — no manual "Analizar" click
--     required.
--   - claim_visual_embedding_jobs(): atomic job claim (FOR UPDATE SKIP
--     LOCKED) that also reclaims stuck "processing" rows in the same
--     statement, so two workers can never process the same row and a
--     crashed worker can never block a row forever.
--   - enqueue_missing_visual_embedding_jobs(): backfill for images that
--     predate this feature, or that need reprocessing after a model/version
--     bump.
--   - match_product_images_by_visual_embedding(): category-filtered cosine
--     similarity search over the new embeddings. Deliberately does NOT
--     group by product (unlike the legacy match_product_images_by_embedding)
--     — per-product grouping and the consensus bonus happen in the
--     application layer, which needs to see every matching image of a
--     product, not just its best one.
--   - visual_search_cache: short-TTL cache of full search responses, keyed
--     by query image hash + scope + model/preprocessing/ranking versions.

-- pgvector was already enabled by 20260406000000_visual_search.sql.

-- ============================================================
-- ACTIVE MODEL CONFIG (singleton)
-- ============================================================

CREATE TABLE visual_embedding_active_config (
  id                    boolean     PRIMARY KEY DEFAULT true CHECK (id),

  provider              text        NOT NULL,
  model                 text        NOT NULL,
  model_version         text        NOT NULL,
  dimensions            integer     NOT NULL CHECK (dimensions > 0),
  preprocessing_version text        NOT NULL,

  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER visual_embedding_active_config_set_updated_at
  BEFORE UPDATE ON visual_embedding_active_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed with the initial provider selected for this project (see
-- services/visual-search-inference README for the model comparison).
-- The worker Edge Function overwrites this row on every run from its own
-- VISUAL_EMBEDDING_* config, so this seed only matters until the first run.
INSERT INTO visual_embedding_active_config (id, provider, model, model_version, dimensions, preprocessing_version)
VALUES (true, 'dinov2', 'facebook/dinov2-small', 'v1', 384, 'v1')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE visual_embedding_active_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visual_embedding_active_config: admin read"
  ON visual_embedding_active_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION set_visual_embedding_active_config(
  p_provider              text,
  p_model                 text,
  p_model_version         text,
  p_dimensions            integer,
  p_preprocessing_version text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO visual_embedding_active_config (id, provider, model, model_version, dimensions, preprocessing_version, updated_at)
  VALUES (true, p_provider, p_model, p_model_version, p_dimensions, p_preprocessing_version, now())
  ON CONFLICT (id) DO UPDATE SET
    provider              = EXCLUDED.provider,
    model                 = EXCLUDED.model,
    model_version         = EXCLUDED.model_version,
    dimensions            = EXCLUDED.dimensions,
    preprocessing_version = EXCLUDED.preprocessing_version,
    updated_at             = now();
$$;

REVOKE ALL ON FUNCTION set_visual_embedding_active_config(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_visual_embedding_active_config(text, text, text, integer, text) TO service_role;


-- ============================================================
-- PRODUCT IMAGE VISUAL EMBEDDINGS
-- ============================================================

CREATE TABLE product_image_visual_embeddings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id            uuid        NOT NULL REFERENCES products(id)       ON DELETE CASCADE,
  product_image_id      uuid        NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,

  -- Unknown until the worker downloads the image; populated when it does.
  image_sha256          text,

  status                text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count         integer     NOT NULL DEFAULT 0,
  last_error_code       text,
  last_error_message    text,

  -- Stamped from visual_embedding_active_config when the job is created,
  -- so a model/version change never mixes vectors from different models in
  -- the same logical "slot" — it creates a new row instead (see the unique
  -- constraint below).
  provider              text        NOT NULL,
  model                 text        NOT NULL,
  model_version         text        NOT NULL,
  dimensions            integer     NOT NULL CHECK (dimensions > 0),
  preprocessing_version text        NOT NULL,

  visual_embedding      vector(384),

  source_width          integer,
  source_height         integer,
  processed_width       integer,
  processed_height      integer,

  processing_started_at  timestamptz,
  processing_finished_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  -- One active row per image per (provider, model, model_version,
  -- preprocessing_version) combination — the upsert target used by both the
  -- auto-enqueue trigger and the worker, mirroring the existing
  -- (product_image_id, analysis_version) pattern in product_image_ai_features.
  UNIQUE (product_image_id, provider, model, model_version, preprocessing_version)
);

CREATE TRIGGER product_image_visual_embeddings_set_updated_at
  BEFORE UPDATE ON product_image_visual_embeddings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_piv_embeddings_product_id       ON product_image_visual_embeddings(product_id);
CREATE INDEX idx_piv_embeddings_product_image_id ON product_image_visual_embeddings(product_image_id);
CREATE INDEX idx_piv_embeddings_status           ON product_image_visual_embeddings(status);

-- Cosine-similarity ANN index over the pixel embeddings. lists=100 is a
-- reasonable default for small/medium catalogs (tune later with
-- `ALTER INDEX ... SET (lists = N)` once the real row count is known).
CREATE INDEX idx_piv_embeddings_vector ON product_image_visual_embeddings
  USING ivfflat (visual_embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE product_image_visual_embeddings ENABLE ROW LEVEL SECURITY;

-- Admin (authenticated) can read job status for the admin panel. Only
-- service_role (Edge Functions) can write — it bypasses RLS entirely, so no
-- write policy is defined here. The embedding column itself is never
-- selected by any frontend/admin query (enforced in application code, not
-- by RLS) — the only sanctioned way to compare embeddings is the RPC below.
CREATE POLICY "product_image_visual_embeddings: admin read"
  ON product_image_visual_embeddings
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- AUTO-ENQUEUE: new images and image replacements
-- ============================================================

CREATE OR REPLACE FUNCTION enqueue_visual_embedding_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
BEGIN
  SELECT provider, model, model_version, dimensions, preprocessing_version
  INTO cfg
  FROM visual_embedding_active_config
  WHERE id = true;

  -- No active config yet (feature not configured) — do not block the
  -- product_images write, simply skip creating a job.
  IF cfg IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO product_image_visual_embeddings (
    product_id, product_image_id, status, attempt_count,
    provider, model, model_version, dimensions, preprocessing_version
  )
  VALUES (
    NEW.product_id, NEW.id, 'pending', 0,
    cfg.provider, cfg.model, cfg.model_version, cfg.dimensions, cfg.preprocessing_version
  )
  ON CONFLICT (product_image_id, provider, model, model_version, preprocessing_version)
  DO UPDATE SET
    status                  = 'pending',
    attempt_count            = 0,
    last_error_code          = NULL,
    last_error_message       = NULL,
    processing_started_at    = NULL,
    processing_finished_at   = NULL,
    updated_at               = now();

  RETURN NEW;
END;
$$;

-- New image uploaded: always enqueue.
CREATE TRIGGER product_images_enqueue_visual_embedding_on_insert
  AFTER INSERT ON product_images
  FOR EACH ROW EXECUTE FUNCTION enqueue_visual_embedding_job();

-- Existing image replaced in place (storage_path changed): re-enqueue so
-- the stale embedding never silently lingers as "completed".
CREATE TRIGGER product_images_enqueue_visual_embedding_on_update
  AFTER UPDATE OF storage_path ON product_images
  FOR EACH ROW
  WHEN (OLD.storage_path IS DISTINCT FROM NEW.storage_path)
  EXECUTE FUNCTION enqueue_visual_embedding_job();


-- ============================================================
-- JOB CLAIMING (atomic, with stuck-job recovery built in)
-- ============================================================

-- Single statement: first fails permanently-stuck jobs that already
-- exhausted their retry budget, then claims a batch of pending jobs plus
-- any remaining stuck "processing" jobs (still under the retry budget),
-- using FOR UPDATE SKIP LOCKED so concurrent callers never claim the same
-- row twice.
CREATE OR REPLACE FUNCTION claim_visual_embedding_jobs(
  p_batch_size    integer DEFAULT 10,
  p_stale_minutes integer DEFAULT 5,
  p_max_attempts  integer DEFAULT 4
)
RETURNS SETOF product_image_visual_embeddings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH failed_stale AS (
    UPDATE product_image_visual_embeddings
    SET status                  = 'failed',
        last_error_code          = 'stale_timeout',
        last_error_message       = 'Se superó el número máximo de reintentos tras quedar atascado en procesamiento.',
        processing_finished_at   = now(),
        updated_at               = now()
    WHERE status = 'processing'
      AND processing_started_at < now() - (p_stale_minutes::text || ' minutes')::interval
      AND attempt_count >= p_max_attempts
    RETURNING id
  ),
  claimable AS (
    SELECT id
    FROM product_image_visual_embeddings
    WHERE id NOT IN (SELECT id FROM failed_stale)
      AND (
        status = 'pending'
        OR (status = 'processing' AND processing_started_at < now() - (p_stale_minutes::text || ' minutes')::interval)
      )
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE product_image_visual_embeddings j
  SET status                 = 'processing',
      attempt_count           = j.attempt_count + 1,
      processing_started_at   = now(),
      processing_finished_at  = NULL,
      last_error_code         = NULL,
      last_error_message      = NULL,
      updated_at              = now()
  FROM claimable c
  WHERE j.id = c.id
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION claim_visual_embedding_jobs(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_visual_embedding_jobs(integer, integer, integer) TO service_role;


-- ============================================================
-- BACKFILL: images that predate this feature or a model/version bump
-- ============================================================

CREATE OR REPLACE FUNCTION enqueue_missing_visual_embedding_jobs(p_batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  inserted_count integer;
BEGIN
  SELECT provider, model, model_version, dimensions, preprocessing_version
  INTO cfg
  FROM visual_embedding_active_config
  WHERE id = true;

  IF cfg IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO product_image_visual_embeddings (
    product_id, product_image_id, status, attempt_count,
    provider, model, model_version, dimensions, preprocessing_version
  )
  SELECT pi.product_id, pi.id, 'pending', 0,
         cfg.provider, cfg.model, cfg.model_version, cfg.dimensions, cfg.preprocessing_version
  FROM product_images pi
  WHERE NOT EXISTS (
    SELECT 1 FROM product_image_visual_embeddings v
    WHERE v.product_image_id      = pi.id
      AND v.provider               = cfg.provider
      AND v.model                  = cfg.model
      AND v.model_version          = cfg.model_version
      AND v.preprocessing_version  = cfg.preprocessing_version
  )
  ORDER BY pi.created_at ASC
  LIMIT p_batch_size
  ON CONFLICT (product_image_id, provider, model, model_version, preprocessing_version) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_missing_visual_embedding_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_missing_visual_embedding_jobs(integer) TO service_role;


-- ============================================================
-- RETRY: explicit admin action for permanently-failed jobs
-- ============================================================

-- Deliberately separate from claim_visual_embedding_jobs' automatic stale-
-- job recovery: a 'failed' row (retries exhausted, or a hard error like
-- corrupt image bytes) is never retried automatically — only an explicit
-- admin action ("Reintentar fallidas") resets it back to 'pending'.
CREATE OR REPLACE FUNCTION retry_failed_visual_embedding_jobs(p_batch_size integer DEFAULT 50)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH to_retry AS (
    SELECT id FROM product_image_visual_embeddings
    WHERE status = 'failed'
    ORDER BY updated_at ASC
    LIMIT p_batch_size
  ),
  reset AS (
    UPDATE product_image_visual_embeddings j
    SET status                 = 'pending',
        attempt_count           = 0,
        last_error_code         = NULL,
        last_error_message      = NULL,
        processing_started_at   = NULL,
        processing_finished_at  = NULL,
        updated_at              = now()
    FROM to_retry t
    WHERE j.id = t.id
    RETURNING j.id
  )
  SELECT count(*)::integer FROM reset;
$$;

REVOKE ALL ON FUNCTION retry_failed_visual_embedding_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retry_failed_visual_embedding_jobs(integer) TO service_role;


-- ============================================================
-- VECTOR CANDIDATE RETRIEVAL (category-filtered, NOT grouped by product)
-- ============================================================

-- category_ids = NULL or empty => global search (no category filter).
-- provider/model/model_version = NULL => matched against any (used only for
-- admin/debug tooling; the search Edge Function always passes concrete
-- values so it never mixes vectors from different model families).
-- The category filter runs INSIDE this query, before match_count limits the
-- result set — never after fetching all candidates. Unlike
-- match_product_images_by_embedding (legacy), this does NOT collapse
-- multiple images of the same product into one row: the application layer
-- needs every matching image per product to compute the consensus bonus.
CREATE OR REPLACE FUNCTION match_product_images_by_visual_embedding(
  query_embedding      vector(384),
  category_ids         uuid[] DEFAULT NULL,
  provider             text DEFAULT NULL,
  model                text DEFAULT NULL,
  model_version        text DEFAULT NULL,
  match_count          integer DEFAULT 60,
  minimum_similarity   double precision DEFAULT 0.15
)
RETURNS TABLE (
  product_id            uuid,
  product_image_id      uuid,
  similarity            double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.product_id,
    v.product_image_id,
    1 - (v.visual_embedding <=> query_embedding) AS similarity
  FROM product_image_visual_embeddings v
  JOIN products p ON p.id = v.product_id
  WHERE v.status = 'completed'
    AND v.visual_embedding IS NOT NULL
    AND (provider IS NULL OR v.provider = provider)
    AND (model IS NULL OR v.model = model)
    AND (model_version IS NULL OR v.model_version = model_version)
    AND p.status = 'published'
    AND (
      category_ids IS NULL
      OR array_length(category_ids, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM product_categories pc
        WHERE pc.product_id  = v.product_id
          AND pc.category_id = ANY(category_ids)
      )
    )
    AND (1 - (v.visual_embedding <=> query_embedding)) >= minimum_similarity
  ORDER BY v.visual_embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_product_images_by_visual_embedding(vector, uuid[], text, text, text, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_product_images_by_visual_embedding(vector, uuid[], text, text, text, integer, double precision) TO service_role;


-- ============================================================
-- SEARCH RESPONSE CACHE
-- ============================================================

CREATE TABLE visual_search_cache (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  cache_key              text        NOT NULL UNIQUE,
  query_image_sha256     text        NOT NULL,
  category_id            uuid        REFERENCES categories(id) ON DELETE SET NULL,

  provider               text        NOT NULL,
  model                  text        NOT NULL,
  model_version          text        NOT NULL,
  preprocessing_version  text        NOT NULL,
  ranking_version        text        NOT NULL,

  -- The full VisualProductSearchResponse, never the query photo itself and
  -- never a raw embedding vector.
  response_payload       jsonb       NOT NULL,

  expires_at             timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visual_search_cache_expires_at ON visual_search_cache(expires_at);

ALTER TABLE visual_search_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (Edge Functions) ever reads or writes the
-- cache; it bypasses RLS. There is no legitimate reason for the browser or
-- an authenticated admin session to read cached search payloads directly.

CREATE OR REPLACE FUNCTION delete_expired_visual_search_cache()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM visual_search_cache WHERE expires_at < now() RETURNING 1
  )
  SELECT count(*)::integer FROM deleted;
$$;

REVOKE ALL ON FUNCTION delete_expired_visual_search_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_expired_visual_search_cache() TO service_role;
