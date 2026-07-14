import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

describe('loadConfig', () => {
  it('falls back to the documented defaults when no env vars are set', () => {
    const config = loadConfig(() => undefined)
    expect(config.embeddingModel).toBe('text-embedding-3-large')
    expect(config.embeddingDimensions).toBe(1536)
    expect(config.globalTopK).toBe(25)
    expect(config.categoryTopK).toBe(15)
    expect(config.globalRerankK).toBe(8)
    expect(config.categoryRerankK).toBe(6)
    expect(config.exactThreshold).toBe(0.92)
    expect(config.likelyThreshold).toBe(0.8)
    expect(config.similarThreshold).toBe(0.62)
    expect(config.closeResultMargin).toBe(0.04)
    expect(config.maxFileMb).toBe(8)
    expect(config.debug).toBe(false)
  })

  it('debug is disabled by default and only turns on with an explicit "true"', () => {
    expect(loadConfig(() => undefined).debug).toBe(false)
    expect(loadConfig((name) => (name === 'VISUAL_SEARCH_DEBUG' ? 'false' : undefined)).debug).toBe(false)
    expect(loadConfig((name) => (name === 'VISUAL_SEARCH_DEBUG' ? 'anything-else' : undefined)).debug).toBe(false)
    expect(loadConfig((name) => (name === 'VISUAL_SEARCH_DEBUG' ? 'true' : undefined)).debug).toBe(true)
  })

  it('selecting a category must reduce retrieval and reranking limits', () => {
    const config = loadConfig(() => undefined)
    expect(config.categoryTopK).toBeLessThan(config.globalTopK)
    expect(config.categoryRerankK).toBeLessThan(config.globalRerankK)
  })

  it('reads overrides from the provided env getter', () => {
    const env: Record<string, string> = { VISUAL_SEARCH_GLOBAL_TOP_K: '40' }
    const config = loadConfig((name) => env[name])
    expect(config.globalTopK).toBe(40)
  })

  it('ignores invalid numeric overrides and falls back to the default', () => {
    const config = loadConfig((name) => (name === 'VISUAL_SEARCH_GLOBAL_TOP_K' ? 'not-a-number' : undefined))
    expect(config.globalTopK).toBe(25)
  })
})
