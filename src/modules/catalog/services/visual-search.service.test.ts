import { describe, expect, it } from 'vitest'
import { normalizeVisualSearchResponse } from './visual-search.service'

describe('normalizeVisualSearchResponse', () => {
  it('passes through the new V2 contract (status/results/scope/meta) unchanged in shape', () => {
    const payload = {
      status: 'results_found',
      results: [
        {
          productId: 'p1',
          ci: 'CI-1',
          reference: 'REF-1',
          name: 'Bobina',
          brand: 'Bosch',
          primaryImageUrl: 'https://x/a.jpg',
          matchedImageUrl: 'https://x/b.jpg',
          categoryName: 'Encendido',
          compatibilitySummary: ['Toyota Corolla 2015-2018'],
          finalScore: 0.9,
          similarityLabel: 'Alta',
          matchType: 'high_similarity',
          productUrl: '/p/p1',
        },
      ],
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      meta: { processingTimeMs: 120, cacheHit: false, usedOpenAi: false },
    }

    const normalized = normalizeVisualSearchResponse(payload)

    expect(normalized.status).toBe('results_found')
    expect(normalized.results).toHaveLength(1)
    expect(normalized.results[0]).toMatchObject({
      productId: 'p1',
      ci: 'CI-1',
      reference: 'REF-1',
      name: 'Bobina',
      brand: 'Bosch',
      primaryImageUrl: 'https://x/a.jpg',
      matchedImageUrl: 'https://x/b.jpg',
      categoryName: 'Encendido',
      compatibilitySummary: ['Toyota Corolla 2015-2018'],
      finalScore: 0.9,
      similarityLabel: 'Alta',
      matchType: 'high_similarity',
      productUrl: '/p/p1',
    })
    expect(normalized.meta).toEqual({ processingTimeMs: 120, cacheHit: false, usedOpenAi: false })
  })

  it('normalizes the legacy contract (candidates, no exactMatch)', () => {
    const payload = {
      status: 'similar_results',
      candidates: [
        {
          productId: 'p1',
          ci: 'CI-1',
          name: 'Bobina',
          brand: null,
          imageUrl: 'https://x/a.jpg',
          matchedImageUrl: null,
          categories: [{ id: 'c1', name: 'Encendido' }],
          compatibilitySummary: [],
          confidence: 0.7,
          confidenceLabel: 'alta',
        },
      ],
      scope: { isGlobalSearch: false, selectedCategoryId: 'c1', selectedCategoryName: 'Encendido', includedCategoryIds: ['c1'] },
      queryAnalysis: { partType: null, categoryGuess: null, brandVisible: null, referenceCodes: [], imageQuality: 'good', warnings: [] },
      meta: { indexedImagesInScope: 10, candidatesRetrieved: 1, candidatesReranked: 1, processingTimeMs: 300, modelVersion: 'legacy', resultCount: 1 },
    }

    const normalized = normalizeVisualSearchResponse(payload)

    expect(normalized.status).toBe('results_found')
    expect(normalized.results).toHaveLength(1)
    expect(normalized.results[0].productId).toBe('p1')
    expect(normalized.results[0].primaryImageUrl).toBe('https://x/a.jpg')
    expect(normalized.results[0].categoryName).toBe('Encendido')
    expect(normalized.results[0].similarityLabel).toBe('Alta')
    expect(normalized.results[0].finalScore).toBe(0.7)
    expect(normalized.scope).toEqual({ isGlobalSearch: false, selectedCategoryId: 'c1', selectedCategoryName: 'Encendido' })
  })

  it('normalizes the legacy contract when only exactMatch is present (no candidates)', () => {
    const payload = {
      status: 'exact_match',
      exactMatch: {
        productId: 'p1',
        ci: 'CI-1',
        name: 'Bobina',
        brand: 'Bosch',
        imageUrl: 'https://x/a.jpg',
        matchedImageUrl: null,
        categories: [],
        compatibilitySummary: [],
        confidence: 1,
        confidenceLabel: 'exacta',
      },
      candidates: [],
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      meta: {},
    }

    const normalized = normalizeVisualSearchResponse(payload)

    expect(normalized.status).toBe('exact_match')
    expect(normalized.results).toHaveLength(1)
    expect(normalized.results[0].productId).toBe('p1')
    expect(normalized.results[0].similarityLabel).toBe('Referencia exacta')
    expect(normalized.results[0].matchType).toBe('exact_reference')
  })

  it('puts exactMatch first and never duplicates it when it also appears in candidates', () => {
    const exactMatch = { productId: 'p1', ci: 'CI-1', name: 'Bobina exacta', confidenceLabel: 'exacta' }
    const payload = {
      status: 'exact_match',
      exactMatch,
      candidates: [
        exactMatch, // some backend versions echoed the exact match back inside candidates too
        { productId: 'p2', ci: 'CI-2', name: 'Bobina similar', confidenceLabel: 'alta' },
      ],
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      meta: {},
    }

    const normalized = normalizeVisualSearchResponse(payload)

    expect(normalized.results).toHaveLength(2)
    expect(normalized.results[0].productId).toBe('p1')
    expect(normalized.results[1].productId).toBe('p2')
    expect(normalized.results.filter((r) => r.productId === 'p1')).toHaveLength(1)
  })

  it('returns an empty results array (not undefined) when there are no results', () => {
    const payload = {
      status: 'no_match',
      candidates: [],
      exactMatch: null,
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      meta: {},
    }

    const normalized = normalizeVisualSearchResponse(payload)

    expect(Array.isArray(normalized.results)).toBe(true)
    expect(normalized.results).toEqual([])
    expect(normalized.status).toBe('no_results')
  })

  it('maps not_indexed through untouched', () => {
    const payload = {
      status: 'not_indexed',
      results: [],
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      meta: {},
    }
    expect(normalizeVisualSearchResponse(payload).status).toBe('not_indexed')
  })

  it('defaults compatibilitySummary to [] when absent', () => {
    const payload = { results: [{ productId: 'p1', name: 'X' }] }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results[0].compatibilitySummary).toEqual([])
  })

  it('defaults categoryName to null when categories/categoryName are both absent', () => {
    const payload = { results: [{ productId: 'p1', name: 'X' }] }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results[0].categoryName).toBeNull()
  })

  it('drops a malformed result item (missing productId) instead of crashing', () => {
    const payload = { results: [{ name: 'no id here' }, { productId: 'p2', name: 'valid' }] }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results).toHaveLength(1)
    expect(normalized.results[0].productId).toBe('p2')
  })

  it('never throws and always returns an array for a completely malformed payload', () => {
    for (const malformed of [null, undefined, 'a string response', 42, [], {}]) {
      expect(() => normalizeVisualSearchResponse(malformed)).not.toThrow()
      const normalized = normalizeVisualSearchResponse(malformed)
      expect(Array.isArray(normalized.results)).toBe(true)
      expect(normalized.results).toEqual([])
    }
  })

  it('regression: a payload with no results/candidates/exactMatch at all never produces undefined results', () => {
    // This is exactly the shape that used to crash ResultsPanel with
    // "Cannot read properties of undefined (reading 'map')" — status
    // present, but no results-bearing field of any kind.
    const payload = { status: 'results_found', scope: { isGlobalSearch: true } }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results).not.toBeUndefined()
    expect(Array.isArray(normalized.results)).toBe(true)
    expect(() => normalized.results.map((r) => r.productId)).not.toThrow()
  })

  it('is resilient when results/candidates arrays contain non-object items', () => {
    const payload = { results: [null, 'garbage', 42, { productId: 'p1', name: 'ok' }] }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results).toHaveLength(1)
    expect(normalized.results[0].productId).toBe('p1')
  })

  it('falls back to an unrecognized-but-safe similarity label instead of crashing a badge lookup', () => {
    const payload = { results: [{ productId: 'p1', name: 'X', similarityLabel: 'algo-inesperado' }] }
    const normalized = normalizeVisualSearchResponse(payload)
    expect(normalized.results[0].similarityLabel).toBe('Relacionada')
  })

  it('normalizes meta fields to safe defaults when meta is missing entirely', () => {
    const normalized = normalizeVisualSearchResponse({ results: [] })
    expect(normalized.meta).toEqual({ processingTimeMs: 0, cacheHit: false, usedOpenAi: false })
  })

  it('normalizes scope to a safe global-search default when scope is missing entirely', () => {
    const normalized = normalizeVisualSearchResponse({ results: [] })
    expect(normalized.scope).toEqual({ isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null })
  })
})
