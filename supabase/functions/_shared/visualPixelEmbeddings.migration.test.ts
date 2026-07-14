import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Structural checks against the actual migration SQL — the properties that
// matter most (cascade deletes, RLS, atomic job claiming, filtering before
// limiting) can't be exercised without a live Postgres + pgvector instance,
// so this locks in the SQL text itself as a lightweight regression guard,
// mirroring _shared/migration.test.ts for the legacy visual_search migration.
const migrationPath = fileURLToPath(
  new URL('../../migrations/20260407000000_visual_pixel_embeddings.sql', import.meta.url),
)
const sql = readFileSync(migrationPath, 'utf-8')

describe('visual pixel embeddings migration SQL', () => {
  it('does not touch the legacy product_image_ai_features table', () => {
    expect(sql).not.toContain('DROP TABLE product_image_ai_features')
    expect(sql).not.toContain('ALTER TABLE product_image_ai_features')
  })

  it('cascades deletes from products and product_images', () => {
    expect(sql).toMatch(/product_id\s+uuid\s+NOT NULL REFERENCES products\(id\)\s+ON DELETE CASCADE/)
    expect(sql).toMatch(/product_image_id\s+uuid\s+NOT NULL REFERENCES product_images\(id\)\s+ON DELETE CASCADE/)
  })

  it('enables RLS on every new table and grants no direct write access to authenticated/anon', () => {
    for (const table of [
      'visual_embedding_active_config',
      'product_image_visual_embeddings',
      'visual_search_cache',
    ]) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    }
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)\s+TO (authenticated|anon)/)
  })

  it('scopes one job per image per exact model/preprocessing combination', () => {
    expect(sql).toContain(
      'UNIQUE (product_image_id, provider, model, model_version, preprocessing_version)',
    )
  })

  it('enqueues a job automatically on insert and on image replacement, without blocking the write', () => {
    expect(sql).toContain('AFTER INSERT ON product_images')
    expect(sql).toContain('AFTER UPDATE OF storage_path ON product_images')
    expect(sql).toContain('RETURN NEW;')
  })

  it('claims jobs atomically with SKIP LOCKED so two workers cannot claim the same row', () => {
    expect(sql).toContain('FOR UPDATE SKIP LOCKED')
  })

  it('recovers stuck jobs and fails them permanently once retries are exhausted, in the same claim statement', () => {
    expect(sql).toContain('failed_stale')
    expect(sql).toMatch(/status\s+=\s+'failed'/)
    expect(sql).toContain('attempt_count >= p_max_attempts')
    expect(sql).toMatch(/status = 'processing'\s+AND processing_started_at < now\(\)/)
  })

  it('never reclaims a row already marked failed inside the same claim call', () => {
    const claimFnIndex = sql.indexOf('CREATE OR REPLACE FUNCTION claim_visual_embedding_jobs')
    const claimableIndex = sql.indexOf('claimable AS', claimFnIndex)
    const claimableEndIndex = sql.indexOf('FOR UPDATE SKIP LOCKED', claimableIndex)
    expect(claimFnIndex).toBeGreaterThan(-1)
    expect(claimableIndex).toBeGreaterThan(claimFnIndex)
    expect(claimableEndIndex).toBeGreaterThan(claimableIndex)
    expect(sql.slice(claimableIndex, claimableEndIndex)).toContain('id NOT IN (SELECT id FROM failed_stale)')
  })

  it('filters candidates by category before the match_count limit', () => {
    const fnIndex = sql.indexOf('CREATE OR REPLACE FUNCTION match_product_images_by_visual_embedding')
    const existsIndex = sql.indexOf('EXISTS (\n        SELECT 1 FROM product_categories pc', fnIndex)
    const limitIndex = sql.indexOf('LIMIT match_count', fnIndex)
    expect(fnIndex).toBeGreaterThan(-1)
    expect(existsIndex).toBeGreaterThan(fnIndex)
    expect(limitIndex).toBeGreaterThan(existsIndex)
  })

  it('does not group vector matches by product inside the RPC (grouping happens in application code)', () => {
    const fnIndex = sql.indexOf('CREATE OR REPLACE FUNCTION match_product_images_by_visual_embedding')
    const fnEnd = sql.indexOf('REVOKE ALL ON FUNCTION match_product_images_by_visual_embedding', fnIndex)
    expect(sql.slice(fnIndex, fnEnd)).not.toContain('DISTINCT ON')
  })

  it('only matches embeddings from a compatible, completed model/version', () => {
    expect(sql).toContain("v.status = 'completed'")
    expect(sql).toContain('provider IS NULL OR v.provider = provider')
    expect(sql).toContain('model_version IS NULL OR v.model_version = model_version')
  })

  it('never auto-retries a permanently failed job — only reclaims stuck processing rows', () => {
    const claimFnIndex = sql.indexOf('CREATE OR REPLACE FUNCTION claim_visual_embedding_jobs')
    const claimFnEnd = sql.indexOf('REVOKE ALL ON FUNCTION claim_visual_embedding_jobs', claimFnIndex)
    expect(sql.slice(claimFnIndex, claimFnEnd)).not.toContain("status = 'failed'\n  )")
    expect(sql).toContain('retry_failed_visual_embedding_jobs')
    expect(sql).toContain("WHERE status = 'failed'")
  })

  it('does not create any trigger on the products table (price/stock/category changes never regenerate the vector)', () => {
    expect(sql).not.toMatch(/CREATE TRIGGER[\s\S]{0,80}ON products/)
  })

  it('restricts every new RPC/job function to service_role only', () => {
    for (const fn of [
      'claim_visual_embedding_jobs(integer, integer, integer)',
      'enqueue_missing_visual_embedding_jobs(integer)',
      'retry_failed_visual_embedding_jobs(integer)',
      'match_product_images_by_visual_embedding(vector, uuid[], text, text, text, integer, double precision)',
      'delete_expired_visual_search_cache()',
      'set_visual_embedding_active_config(text, text, text, integer, text)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO service_role`)
    }
  })

  it('never grants the anon or authenticated role execute access on any new function', () => {
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION[^;]*TO (anon|authenticated)[^;]*;/)
  })

  it('caches by image hash, scope, and every version dimension (model, preprocessing, ranking)', () => {
    expect(sql).toContain('cache_key              text        NOT NULL UNIQUE')
    expect(sql).toContain('query_image_sha256     text        NOT NULL')
    expect(sql).toContain('ranking_version        text        NOT NULL')
    expect(sql).toContain('expires_at             timestamptz NOT NULL')
  })

  it('never stores the query photo or a raw embedding vector in the cache', () => {
    const cacheStart = sql.indexOf('CREATE TABLE visual_search_cache')
    const cacheEnd = sql.indexOf(');', cacheStart)
    const cacheBody = sql.slice(cacheStart, cacheEnd)
    expect(cacheBody).not.toMatch(/vector\(/)
    expect(cacheBody).not.toMatch(/image_bytes|image_base64|query_image_data/)
  })
})
