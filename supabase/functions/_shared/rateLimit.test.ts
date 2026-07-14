import { describe, expect, it } from 'vitest'
import { isRateLimited, type RateLimitPort } from './rateLimit.ts'

describe('isRateLimited', () => {
  it('never limits a request with no IP hash (fail open, not closed)', async () => {
    const port: RateLimitPort = { countRecentEventsByIpHash: async () => 999 }
    expect(await isRateLimited({ ipHash: null, windowMs: 60_000, maxRequests: 5 }, port)).toBe(false)
  })

  it('allows requests under the limit', async () => {
    const port: RateLimitPort = { countRecentEventsByIpHash: async () => 4 }
    expect(await isRateLimited({ ipHash: 'abc', windowMs: 60_000, maxRequests: 5 }, port)).toBe(false)
  })

  it('blocks once the limit is reached', async () => {
    const port: RateLimitPort = { countRecentEventsByIpHash: async () => 5 }
    expect(await isRateLimited({ ipHash: 'abc', windowMs: 60_000, maxRequests: 5 }, port)).toBe(true)
  })
})
