import { describe, expect, it } from 'vitest'
import { applyOpenAiVerdicts, selectTiebreakPool, shouldRunOpenAiTiebreak } from './visualOpenAiTiebreak.ts'
import type { RerankCandidateResult } from './types.ts'

const baseConfig = { openAiEnabled: true, openAiRerankEnabled: true, openAiScoreMargin: 0.04 }

function verdict(overrides: Partial<RerankCandidateResult> = {}): RerankCandidateResult {
  return {
    product_id: 'p1',
    verdict: 'probable',
    confidence: 0.8,
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

describe('shouldRunOpenAiTiebreak', () => {
  it('is false when the feature is disabled', () => {
    const result = shouldRunOpenAiTiebreak(
      [{ finalScore: 0.8 }, { finalScore: 0.79 }],
      { ...baseConfig, openAiEnabled: false },
    )
    expect(result).toBe(false)
  })

  it('is false when rerank is disabled even if the base flag is on', () => {
    const result = shouldRunOpenAiTiebreak(
      [{ finalScore: 0.8 }, { finalScore: 0.79 }],
      { ...baseConfig, openAiRerankEnabled: false },
    )
    expect(result).toBe(false)
  })

  it('is false with fewer than two candidates (nothing to disambiguate)', () => {
    expect(shouldRunOpenAiTiebreak([{ finalScore: 0.8 }], baseConfig)).toBe(false)
    expect(shouldRunOpenAiTiebreak([], baseConfig)).toBe(false)
  })

  it('is false when the top result clearly beats the runner-up', () => {
    const result = shouldRunOpenAiTiebreak([{ finalScore: 0.9 }, { finalScore: 0.5 }], baseConfig)
    expect(result).toBe(false)
  })

  it('is true when the top two candidates are within the score margin', () => {
    const result = shouldRunOpenAiTiebreak([{ finalScore: 0.8 }, { finalScore: 0.78 }], baseConfig)
    expect(result).toBe(true)
  })
})

describe('selectTiebreakPool', () => {
  it('caps the pool at maxCandidates', () => {
    const pool = selectTiebreakPool([1, 2, 3, 4, 5], 3)
    expect(pool).toEqual([1, 2, 3])
  })
})

describe('applyOpenAiVerdicts', () => {
  const candidates = [
    { productId: 'p1', finalScore: 0.6, matchType: 'possible_match' as const, similarityLabel: 'Media' as const },
    { productId: 'p2', finalScore: 0.58, matchType: 'possible_match' as const, similarityLabel: 'Media' as const },
  ]

  it('boosts a candidate with an exact verdict and no contradictions, at least to the score floor', () => {
    const result = applyOpenAiVerdicts(candidates, new Map([['p1', verdict({ product_id: 'p1', verdict: 'exact' })]]))
    const p1 = result.find((c) => c.productId === 'p1')!
    expect(p1.finalScore).toBeGreaterThanOrEqual(0.9)
    expect(p1.matchType).not.toBe('exact_reference')
  })

  it('penalizes a candidate with a not_match verdict', () => {
    const result = applyOpenAiVerdicts(candidates, new Map([['p2', verdict({ product_id: 'p2', verdict: 'not_match' })]]))
    const p2 = result.find((c) => c.productId === 'p2')!
    expect(p2.finalScore).toBeLessThan(0.58)
  })

  it('never turns a verdict into exact_reference', () => {
    const result = applyOpenAiVerdicts(candidates, new Map([['p1', verdict({ product_id: 'p1', verdict: 'exact' })]]))
    expect(result.every((c) => c.matchType !== 'exact_reference')).toBe(true)
  })

  it('leaves candidates without a verdict unchanged', () => {
    const result = applyOpenAiVerdicts(candidates, new Map())
    expect(result.find((c) => c.productId === 'p1')!.finalScore).toBe(0.6)
  })

  it('re-sorts by the adjusted final score, descending', () => {
    const result = applyOpenAiVerdicts(candidates, new Map([['p2', verdict({ product_id: 'p2', verdict: 'exact' })]]))
    expect(result[0].productId).toBe('p2')
  })
})
