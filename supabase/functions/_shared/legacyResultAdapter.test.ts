import { describe, expect, it } from 'vitest'
import { buildLegacyResponseV2, buildLegacyResultV2 } from './legacyResultAdapter.ts'
import type { ProductDetailRow } from './supabaseSearchPort.ts'
import type { CandidateScore } from './scoring.ts'

const detail: ProductDetailRow = {
  productId: 'prod-1',
  ci: 'CI-1',
  reference: 'REF-1',
  name: 'Bobina de encendido',
  brand: 'Bosch',
  categories: [{ id: 'cat-1', name: 'Encendido' }],
  primaryImagePath: 'prod-1/main.jpg',
  compatibilitySummary: ['Toyota Corolla 2015-2018'],
  salePrice: 100,
  stock: 5,
}

function buildPublicImageUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/product-images/${storagePath}`
}

describe('buildLegacyResultV2', () => {
  it('maps an exact reference match to matchType exact_reference', () => {
    const score: CandidateScore = {
      productId: 'prod-1',
      similarityScore: 1,
      visualScore: 1,
      finalScore: 1,
      hasContradictions: false,
      verdict: null,
      isExactReferenceMatch: true,
    }
    const result = buildLegacyResultV2({ detail, score, matchedImageStoragePath: null }, 1, 'https://x.supabase.co', buildPublicImageUrl)
    expect(result.matchType).toBe('exact_reference')
    expect(result.similarityLabel).toBe('Referencia exacta')
  })

  it('classifies a non-exact score using the same thresholds as the new pipeline', () => {
    const score: CandidateScore = {
      productId: 'prod-1',
      similarityScore: 0.9,
      visualScore: 0.9,
      finalScore: 0.9,
      hasContradictions: false,
      verdict: 'probable',
      isExactReferenceMatch: false,
    }
    const result = buildLegacyResultV2({ detail, score, matchedImageStoragePath: null }, 1, 'https://x.supabase.co', buildPublicImageUrl)
    expect(result.matchType).toBe('very_high_similarity')
  })

  it('carries over reference, brand, category, and compatibility from the product detail', () => {
    const score: CandidateScore = {
      productId: 'prod-1',
      similarityScore: 0.5,
      visualScore: 0.5,
      finalScore: 0.5,
      hasContradictions: false,
      verdict: 'similar',
      isExactReferenceMatch: false,
    }
    const result = buildLegacyResultV2({ detail, score, matchedImageStoragePath: null }, 1, 'https://x.supabase.co', buildPublicImageUrl)
    expect(result.reference).toBe('REF-1')
    expect(result.brand).toBe('Bosch')
    expect(result.categoryName).toBe('Encendido')
    expect(result.compatibilitySummary).toEqual(['Toyota Corolla 2015-2018'])
  })

  it('never reports a local visual similarity, since the legacy pipeline never ran local reranking', () => {
    const score: CandidateScore = {
      productId: 'prod-1',
      similarityScore: 0.5,
      visualScore: 0.5,
      finalScore: 0.5,
      hasContradictions: false,
      verdict: 'similar',
      isExactReferenceMatch: false,
    }
    const result = buildLegacyResultV2({ detail, score, matchedImageStoragePath: null }, 1, 'https://x.supabase.co', buildPublicImageUrl)
    expect(result.localVisualSimilarity).toBeNull()
  })
})

describe('buildLegacyResponseV2', () => {
  it('reports engine: legacy and usedLocalReranking/usedLocalOcr as false', () => {
    const response = buildLegacyResponseV2({
      searchId: 'search-1',
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      indexedImagesInScope: 10,
      candidatesRetrieved: 3,
      results: [],
      hasExactMatch: false,
      processingTimeMs: 120,
      usedOpenAi: true,
      openAiCallCount: 2,
    })
    expect(response.meta.engine).toBe('legacy')
    expect(response.meta.usedLocalReranking).toBe(false)
    expect(response.meta.usedLocalOcr).toBe(false)
    expect(response.meta.usedOpenAi).toBe(true)
    expect(response.meta.openAiCallCount).toBe(2)
  })

  it('returns not_indexed when the scope has no indexed images', () => {
    const response = buildLegacyResponseV2({
      searchId: 'search-1',
      scope: { isGlobalSearch: true, selectedCategoryId: null, selectedCategoryName: null },
      indexedImagesInScope: 0,
      candidatesRetrieved: 0,
      results: [],
      hasExactMatch: false,
      processingTimeMs: 10,
      usedOpenAi: false,
      openAiCallCount: 0,
    })
    expect(response.status).toBe('not_indexed')
  })
})
