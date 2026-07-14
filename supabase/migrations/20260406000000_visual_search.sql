-- ============================================================
-- Visual product search (image search powered by OpenAI)
-- ============================================================
--
-- Adds:
--   - pgvector extension
--   - product_image_ai_features: one row per (product_image, analysis_version)
--     holding the OpenAI structured analysis + embedding for that image
--   - visual_search_events: append-only log used for observability and
--     lightweight rate limiting (no images/base64 are ever stored here)
--   - get_category_descendants(): cycle-safe recursive resolver for the
--     category tree, used to build the "allowed category ids" scope
--   - match_product_images_by_embedding(): category-filtered cosine
--     similarity search over indexed product images
--
-- product_categories already has the indexes this feature needs:
--   - PRIMARY KEY (product_id, category_id) covers product_id lookups
--     and the (product_id, category_id) combination
--   - idx_product_categories_category_id covers category_id lookups
-- No additional indexes are added on that table.

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- PRODUCT IMAGE AI FEATURES
-- ============================================================

CREATE TABLE product_image_ai_features (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id            uuid        NOT NULL REFERENCES products(id)       ON DELETE CASCADE,
  product_image_id      uuid        NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,

  image_sha256          text        NOT NULL,

  status                text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  analysis_version      integer     NOT NULL DEFAULT 1,
  vision_model          text,
  embedding_model       text,
  embedding_dimensions  integer,

  -- Structured AutomotivePartImageAnalysis (see supabase/functions/_shared/types.ts)
  analysis              jsonb,
  detected_reference_codes text[]   NOT NULL DEFAULT '{}',
  detected_oem_codes       text[]   NOT NULL DEFAULT '{}',
  detected_text            text[]   NOT NULL DEFAULT '{}',

  search_document       text,
  embedding             vector(1536),
  analysis_confidence   numeric(4,3)
                        CHECK (analysis_confidence IS NULL OR (analysis_confidence >= 0 AND analysis_confidence <= 1)),

  error_message         text,
  attempt_count         integer     NOT NULL DEFAULT 0,

  analyzed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Only one active indexing record per image + analysis version.
  UNIQUE (product_image_id, analysis_version)
);

CREATE TRIGGER product_image_ai_features_set_updated_at
  BEFORE UPDATE ON product_image_ai_features
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pi_ai_features_product_id       ON product_image_ai_features(product_id);
CREATE INDEX idx_pi_ai_features_status            ON product_image_ai_features(status);
CREATE INDEX idx_pi_ai_features_image_sha256      ON product_image_ai_features(image_sha256);
CREATE INDEX idx_pi_ai_features_reference_codes   ON product_image_ai_features USING gin(detected_reference_codes);
CREATE INDEX idx_pi_ai_features_oem_codes         ON product_image_ai_features USING gin(detected_oem_codes);

-- Cosine-similarity ANN index. ivfflat requires an estimate of row count
-- via `lists`; 100 is a reasonable default for small/medium catalogs and
-- can be tuned later with `ALTER INDEX ... SET (lists = N)`.
CREATE INDEX idx_pi_ai_features_embedding ON product_image_ai_features
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE product_image_ai_features ENABLE ROW LEVEL SECURITY;

-- Admin (authenticated) can read analysis status/results for the admin panel.
-- Only the service_role (used exclusively from Edge Functions) can write —
-- service_role bypasses RLS entirely, so no write policy is defined here.
CREATE POLICY "product_image_ai_features: admin read"
  ON product_image_ai_features
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- VISUAL SEARCH EVENTS (audit log + rate limiting, no images stored)
-- ============================================================

CREATE TABLE visual_search_events (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  category_id              uuid        REFERENCES categories(id) ON DELETE SET NULL,
  included_category_count  integer     NOT NULL DEFAULT 0,
  is_global_search          boolean     NOT NULL DEFAULT true,

  status                   text        NOT NULL
                           CHECK (status IN ('exact_match', 'likely_match', 'similar_results', 'no_match', 'error')),
  error_code                text,

  candidates_retrieved      integer     NOT NULL DEFAULT 0,
  candidates_reranked       integer     NOT NULL DEFAULT 0,
  processing_time_ms        integer,

  vision_model              text,
  embedding_model           text,

  -- SHA-256 of (ip + daily salt), never the raw IP — used only for rate limiting.
  ip_hash                   text,

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visual_search_events_created_at ON visual_search_events(created_at DESC);
CREATE INDEX idx_visual_search_events_ip_hash     ON visual_search_events(ip_hash, created_at);
CREATE INDEX idx_visual_search_events_category_id ON visual_search_events(category_id);

ALTER TABLE visual_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visual_search_events: admin read"
  ON visual_search_events
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- CATEGORY DESCENDANTS RESOLVER
-- ============================================================

-- Returns the selected category plus every active descendant, at any depth.
-- Cycle-safe: tracks the visited path and stops descending if a category
-- id would repeat. Ignores inactive/deleted categories entirely.
CREATE OR REPLACE FUNCTION get_category_descendants(p_category_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE descendants AS (
    SELECT c.id, ARRAY[c.id] AS path
    FROM categories c
    WHERE c.id = p_category_id
      AND c.is_active = true

    UNION ALL

    SELECT c.id, d.path || c.id
    FROM categories c
    JOIN descendants d ON c.parent_id = d.id
    WHERE c.is_active = true
      AND NOT (c.id = ANY(d.path))
  )
  SELECT id FROM descendants;
$$;

REVOKE ALL ON FUNCTION get_category_descendants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_category_descendants(uuid) TO authenticated, service_role;


-- ============================================================
-- VECTOR CANDIDATE RETRIEVAL (category-filtered, one image per product)
-- ============================================================

-- category_ids = NULL or empty => global search (no category filter).
-- category_ids with values     => restricted to products linked to any of
--                                  those category ids via product_categories.
-- The category filter runs INSIDE this query, before match_count limits
-- the result set — never after fetching all candidates.
CREATE OR REPLACE FUNCTION match_product_images_by_embedding(
  query_embedding      vector(1536),
  category_ids         uuid[] DEFAULT NULL,
  match_count          integer DEFAULT 20,
  minimum_similarity   double precision DEFAULT 0.0
)
RETURNS TABLE (
  product_id            uuid,
  product_image_id      uuid,
  storage_path          text,
  similarity            double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best_per_product AS (
    SELECT DISTINCT ON (f.product_id)
      f.product_id,
      f.product_image_id,
      pi.storage_path,
      1 - (f.embedding <=> query_embedding) AS similarity
    FROM product_image_ai_features f
    JOIN product_images pi ON pi.id = f.product_image_id
    JOIN products p        ON p.id  = f.product_id
    WHERE f.status = 'completed'
      AND f.embedding IS NOT NULL
      AND p.status = 'published'
      AND (
        category_ids IS NULL
        OR array_length(category_ids, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM product_categories pc
          WHERE pc.product_id  = f.product_id
            AND pc.category_id = ANY(category_ids)
        )
      )
    ORDER BY f.product_id, f.embedding <=> query_embedding ASC
  )
  SELECT product_id, product_image_id, storage_path, similarity
  FROM best_per_product
  WHERE similarity >= minimum_similarity
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_product_images_by_embedding(vector, uuid[], integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_product_images_by_embedding(vector, uuid[], integer, double precision) TO service_role;
