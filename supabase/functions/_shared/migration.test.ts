import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Structural checks against the actual migration SQL — the properties that
// matter most (cascade deletes, RLS, filtering before limiting) can't be
// exercised without a live Postgres + pgvector instance, so this locks in
// the SQL text itself as a lightweight regression guard.
const migrationPath = fileURLToPath(
  new URL('../../migrations/20260406000000_visual_search.sql', import.meta.url),
)
const sql = readFileSync(migrationPath, 'utf-8')

describe('visual search migration SQL', () => {
  it('cascades deletes from products and product_images into product_image_ai_features', () => {
    expect(sql).toMatch(/product_id\s+uuid\s+NOT NULL REFERENCES products\(id\)\s+ON DELETE CASCADE/)
    expect(sql).toMatch(/product_image_id\s+uuid\s+NOT NULL REFERENCES product_images\(id\)\s+ON DELETE CASCADE/)
  })

  it('enables RLS and does not grant authenticated/anon write access to AI features', () => {
    expect(sql).toContain('ALTER TABLE product_image_ai_features ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('"product_image_ai_features: admin read"')
    expect(sql).not.toMatch(/product_image_ai_features[\s\S]{0,400}FOR (INSERT|UPDATE|DELETE|ALL)\s+TO (authenticated|anon)/)
  })

  it('enables RLS on the search event log with read-only access for admins', () => {
    expect(sql).toContain('ALTER TABLE visual_search_events ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('"visual_search_events: admin read"')
  })

  it('groups vector matches to one row per product before limiting', () => {
    expect(sql).toMatch(/DISTINCT ON \(f\.product_id\)/)
    // The final LIMIT must come after the per-product grouping and the
    // category filter, not before.
    const distinctIndex = sql.indexOf('DISTINCT ON (f.product_id)')
    const limitIndex = sql.indexOf('LIMIT match_count')
    expect(distinctIndex).toBeGreaterThan(-1)
    expect(limitIndex).toBeGreaterThan(distinctIndex)
  })

  it('filters by category inside the query, before the result is limited', () => {
    const existsIndex = sql.indexOf('EXISTS (\n          SELECT 1 FROM product_categories pc')
    const limitIndex = sql.indexOf('LIMIT match_count')
    expect(existsIndex).toBeGreaterThan(-1)
    expect(limitIndex).toBeGreaterThan(existsIndex)
  })

  it('restricts match_product_images_by_embedding execution to service_role only', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION match_product_images_by_embedding[\s\S]*FROM PUBLIC/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION match_product_images_by_embedding[\s\S]*TO service_role/)
  })

  it('guards the category descendants recursion against cycles', () => {
    expect(sql).toContain('NOT (c.id = ANY(d.path))')
  })

  it('enforces one active indexing record per image and analysis version', () => {
    expect(sql).toContain('UNIQUE (product_image_id, analysis_version)')
  })
})
