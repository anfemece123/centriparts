import { describe, expect, it } from 'vitest'
import { buildVisualSearchCacheKey, computeCacheExpiry, isCacheExpired } from './visualCache.ts'

const baseInput = {
  queryImageSha256: 'abc123',
  categoryId: 'cat-1',
  provider: 'dinov2',
  model: 'facebook/dinov2-small',
  modelVersion: 'v1',
  preprocessingVersion: 'v1',
  rankingVersion: 'v1',
}

describe('buildVisualSearchCacheKey', () => {
  it('is deterministic for identical inputs', async () => {
    const a = await buildVisualSearchCacheKey(baseInput)
    const b = await buildVisualSearchCacheKey({ ...baseInput })
    expect(a).toBe(b)
  })

  it('changes when the category scope changes', async () => {
    const global = await buildVisualSearchCacheKey({ ...baseInput, categoryId: null })
    const scoped = await buildVisualSearchCacheKey(baseInput)
    expect(global).not.toBe(scoped)
  })

  it('changes when the model version changes', async () => {
    const v1 = await buildVisualSearchCacheKey(baseInput)
    const v2 = await buildVisualSearchCacheKey({ ...baseInput, modelVersion: 'v2' })
    expect(v1).not.toBe(v2)
  })

  it('changes when the ranking version changes', async () => {
    const v1 = await buildVisualSearchCacheKey(baseInput)
    const v2 = await buildVisualSearchCacheKey({ ...baseInput, rankingVersion: 'v2' })
    expect(v1).not.toBe(v2)
  })

  it('changes when the query image hash changes', async () => {
    const a = await buildVisualSearchCacheKey(baseInput)
    const b = await buildVisualSearchCacheKey({ ...baseInput, queryImageSha256: 'different-hash' })
    expect(a).not.toBe(b)
  })
})

describe('cache expiry', () => {
  it('computes an expiry timestamp TTL minutes in the future', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const expiry = computeCacheExpiry(60, now)
    expect(expiry.toISOString()).toBe('2026-01-01T01:00:00.000Z')
  })

  it('treats a past expiry as expired', () => {
    const now = new Date('2026-01-01T02:00:00Z')
    const expiry = new Date('2026-01-01T01:00:00Z')
    expect(isCacheExpired(expiry, now)).toBe(true)
  })

  it('treats a future expiry as not expired', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const expiry = new Date('2026-01-01T01:00:00Z')
    expect(isCacheExpired(expiry, now)).toBe(false)
  })
})
