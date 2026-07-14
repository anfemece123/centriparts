import { describe, expect, it } from 'vitest'
import { determineResponseStatus } from './visualResponseStatus.ts'

describe('determineResponseStatus', () => {
  it('returns not_indexed when the scope has zero indexed images, even before checking results', () => {
    const status = determineResponseStatus({ indexedImagesInScope: 0, hasExactMatch: false, resultCount: 0 })
    expect(status).toBe('not_indexed')
  })

  it('returns exact_match when a deterministic reference match was found', () => {
    const status = determineResponseStatus({ indexedImagesInScope: 10, hasExactMatch: true, resultCount: 1 })
    expect(status).toBe('exact_match')
  })

  it('returns results_found when there is no exact match but similar results exist', () => {
    const status = determineResponseStatus({ indexedImagesInScope: 10, hasExactMatch: false, resultCount: 5 })
    expect(status).toBe('results_found')
  })

  it('returns no_results when the scope is indexed but nothing matched', () => {
    const status = determineResponseStatus({ indexedImagesInScope: 10, hasExactMatch: false, resultCount: 0 })
    expect(status).toBe('no_results')
  })
})
