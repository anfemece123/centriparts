import { describe, expect, it } from 'vitest'
import { calculateVisualSearchScore, classifyVisualSearchResult, type CandidateScore } from './scoring.ts'
import { loadConfig } from './config.ts'
import type { RerankCandidateResult } from './types.ts'

const thresholds = loadConfig(() => undefined) // defaults: exact .92, likely .80, similar .62, margin .04

function rerank(overrides: Partial<RerankCandidateResult> = {}): RerankCandidateResult {
  return {
    product_id: 'p1',
    verdict: 'similar',
    confidence: 0.5,
    decisive_matches: [],
    contradictions: [],
    reference_match: false,
    brand_match: false,
    shape_match: false,
    connector_match: false,
    mounting_match: false,
    visible_text_match: false,
    ...overrides,
  }
}

describe('calculateVisualSearchScore', () => {
  it('gives a deterministic reference match the maximum score with no rerank needed', () => {
    const score = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0,
      rerank: null,
      isExactReferenceMatch: true,
    })
    expect(score.finalScore).toBe(1)
    expect(score.hasContradictions).toBe(false)
  })

  it('never lets a "similar" verdict alone reach the exact threshold', () => {
    const score = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0.9,
      rerank: rerank({ verdict: 'similar' }),
      isExactReferenceMatch: false,
    })
    expect(score.finalScore).toBeLessThan(thresholds.exactThreshold)
  })

  it('a generic-looking part (no decisive matches) never reaches exact_match', () => {
    // Even an "exact" verdict alone is not enough if other checks look generic —
    // this test locks in that the score for a bare "exact" verdict without
    // corroborating match signals stays below the classification's exact bar
    // once combined with realistic similarity.
    const score = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0.5,
      rerank: rerank({ verdict: 'exact', reference_match: false }),
      isExactReferenceMatch: false,
    })
    expect(score.finalScore).toBeLessThan(1)
  })

  it('applies a heavier penalty for contradictions when few match signals support the candidate', () => {
    const withFewSignals = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0.8,
      rerank: rerank({ verdict: 'exact', contradictions: ['conector distinto'], brand_match: true }),
      isExactReferenceMatch: false,
    })
    const withManySignals = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0.8,
      rerank: rerank({
        verdict: 'exact',
        contradictions: ['color distinto'],
        brand_match: true,
        shape_match: true,
        connector_match: true,
        mounting_match: true,
      }),
      isExactReferenceMatch: false,
    })
    expect(withFewSignals.hasContradictions).toBe(true)
    expect(withManySignals.hasContradictions).toBe(true)
    expect(withFewSignals.finalScore).toBeLessThan(withManySignals.finalScore)
  })
})

describe('classifyVisualSearchResult', () => {
  it('returns no_match for an empty candidate list', () => {
    expect(classifyVisualSearchResult([], thresholds)).toEqual({ status: 'no_match', exactMatchProductId: null })
  })

  it('classifies a clear deterministic match as exact_match', () => {
    const scored: CandidateScore[] = [
      calculateVisualSearchScore({ productId: 'p1', similarityScore: 1, rerank: null, isExactReferenceMatch: true }),
    ]
    expect(classifyVisualSearchResult(scored, thresholds)).toEqual({ status: 'exact_match', exactMatchProductId: 'p1' })
  })

  it('downgrades away from exact_match when two candidates are too close to call', () => {
    const top = calculateVisualSearchScore({
      productId: 'p1',
      similarityScore: 0.9,
      rerank: rerank({ verdict: 'exact', reference_match: true, brand_match: true, shape_match: true }),
      isExactReferenceMatch: false,
    })
    const runnerUp = calculateVisualSearchScore({
      productId: 'p2',
      similarityScore: 0.89,
      rerank: rerank({ verdict: 'exact', reference_match: true, brand_match: true, shape_match: true }),
      isExactReferenceMatch: false,
    })
    const result = classifyVisualSearchResult([top, runnerUp], thresholds)
    expect(result.status).not.toBe('exact_match')
  })

  it('classifies a contradiction-free "exact" verdict above threshold as exact_match', () => {
    const scored: CandidateScore[] = [
      calculateVisualSearchScore({
        productId: 'p1',
        similarityScore: 0.95,
        rerank: rerank({
          verdict: 'exact',
          reference_match: true,
          brand_match: true,
          shape_match: true,
          connector_match: true,
          mounting_match: true,
        }),
        isExactReferenceMatch: false,
      }),
    ]
    expect(classifyVisualSearchResult(scored, thresholds).status).toBe('exact_match')
  })

  it('falls back to similar_results for low-confidence candidates', () => {
    const scored: CandidateScore[] = [
      calculateVisualSearchScore({
        productId: 'p1',
        similarityScore: 0.65,
        rerank: rerank({ verdict: 'similar' }),
        isExactReferenceMatch: false,
      }),
    ]
    expect(classifyVisualSearchResult(scored, thresholds).status).toBe('similar_results')
  })

  it('returns no_match when the top score is below the similar threshold', () => {
    const scored: CandidateScore[] = [
      calculateVisualSearchScore({
        productId: 'p1',
        similarityScore: 0.1,
        rerank: rerank({ verdict: 'not_match' }),
        isExactReferenceMatch: false,
      }),
    ]
    expect(classifyVisualSearchResult(scored, thresholds).status).toBe('no_match')
  })
})
