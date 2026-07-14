import { describe, expect, it, vi, afterEach } from 'vitest'
import { debugLog } from './debugLog.ts'

describe('debugLog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs nothing when disabled (production default)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog(false, 'search-1', { stage: 'scope_resolved' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('logs the given stage/fields when explicitly enabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog(true, 'search-1', { stage: 'classified', status: 'exact_match', durationMs: 42 })
    expect(spy).toHaveBeenCalledTimes(1)
    const [, payload] = spy.mock.calls[0]
    expect(payload).toContain('"stage":"classified"')
    expect(payload).toContain('"status":"exact_match"')
  })

  it('the entry type has no slot for images, embeddings, keys or tokens — nothing to leak by construction', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog(true, 'search-1', { stage: 'query_image_analyzed', durationMs: 10 })
    const [, payload] = spy.mock.calls[0]
    for (const forbidden of ['embedding', 'base64', 'apiKey', 'authorization', 'signedUrl']) {
      expect(payload.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})
