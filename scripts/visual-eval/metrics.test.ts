import { describe, expect, it } from 'vitest'
import {
  computeEvaluationMetrics,
  computeLatencyStats,
  computeMeanReciprocalRank,
  computePercentWithoutOpenAi,
  computeRecallAtK,
} from './metrics.ts'
import type { EvaluationCaseResult, VisualSearchEvaluationCase } from './types.ts'

function makeCase(overrides: Partial<VisualSearchEvaluationCase> = {}): VisualSearchEvaluationCase {
  return { queryImagePath: 'photos/1.jpg', expectedProductId: 'prod-1', categoryId: null, ...overrides }
}

function makeResult(overrides: Partial<EvaluationCaseResult> = {}): EvaluationCaseResult {
  return {
    case: makeCase(),
    rank: 1,
    latencyMs: 100,
    usedOpenAi: false,
    cacheHit: false,
    ...overrides,
  }
}

describe('computeRecallAtK', () => {
  it('counts a hit only when the rank is within k', () => {
    const results = [makeResult({ rank: 1 }), makeResult({ rank: 3 }), makeResult({ rank: 7 })]
    expect(computeRecallAtK(results, 1)).toBeCloseTo(1 / 3, 5)
    expect(computeRecallAtK(results, 3)).toBeCloseTo(2 / 3, 5)
    expect(computeRecallAtK(results, 10)).toBeCloseTo(1, 5)
  })

  it('treats a null rank (not found) as a miss at every k', () => {
    const results = [makeResult({ rank: null })]
    expect(computeRecallAtK(results, 10)).toBe(0)
  })

  it('returns 0 for an empty result set instead of NaN', () => {
    expect(computeRecallAtK([], 1)).toBe(0)
  })
})

describe('computeMeanReciprocalRank', () => {
  it('averages 1/rank across cases', () => {
    const results = [makeResult({ rank: 1 }), makeResult({ rank: 2 }), makeResult({ rank: 4 })]
    const expected = (1 / 1 + 1 / 2 + 1 / 4) / 3
    expect(computeMeanReciprocalRank(results)).toBeCloseTo(expected, 5)
  })

  it('contributes 0 for a case where the product was never found', () => {
    const results = [makeResult({ rank: 1 }), makeResult({ rank: null })]
    expect(computeMeanReciprocalRank(results)).toBeCloseTo(0.5, 5)
  })
})

describe('computeLatencyStats', () => {
  it('computes mean, median, and p95 over the latency distribution', () => {
    const results = [10, 20, 30, 40, 100].map((latencyMs) => makeResult({ latencyMs }))
    const stats = computeLatencyStats(results)
    expect(stats.mean).toBeCloseTo(40, 5)
    expect(stats.median).toBe(30)
    expect(stats.p95).toBe(100)
  })

  it('returns zeros for an empty result set', () => {
    expect(computeLatencyStats([])).toEqual({ mean: 0, median: 0, p95: 0 })
  })
})

describe('computePercentWithoutOpenAi', () => {
  it('reports the share of searches that never called OpenAI', () => {
    const results = [makeResult({ usedOpenAi: false }), makeResult({ usedOpenAi: false }), makeResult({ usedOpenAi: true })]
    expect(computePercentWithoutOpenAi(results)).toBeCloseTo((2 / 3) * 100, 5)
  })
})

describe('computeEvaluationMetrics', () => {
  it('bundles every metric together consistently', () => {
    const results = [makeResult({ rank: 1, latencyMs: 50, usedOpenAi: false })]
    const metrics = computeEvaluationMetrics(results)
    expect(metrics.totalCases).toBe(1)
    expect(metrics.recallAt1).toBe(1)
    expect(metrics.meanReciprocalRank).toBe(1)
    expect(metrics.percentSearchesWithoutOpenAi).toBe(100)
  })
})
