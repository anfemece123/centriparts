// Pure metric computations — no I/O, fully unit-testable with synthetic
// data even without any real photos on hand (spec sections 7/29).

import type { EvaluationCaseResult, EvaluationMetrics } from './types.ts'

export function computeRecallAtK(results: EvaluationCaseResult[], k: number): number {
  if (results.length === 0) return 0
  const hits = results.filter((r) => r.rank !== null && r.rank <= k).length
  return hits / results.length
}

export function computeMeanReciprocalRank(results: EvaluationCaseResult[]): number {
  if (results.length === 0) return 0
  const reciprocalSum = results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0)
  return reciprocalSum / results.length
}

export interface LatencyStats {
  mean: number
  median: number
  p95: number
}

export function computeLatencyStats(results: EvaluationCaseResult[]): LatencyStats {
  if (results.length === 0) return { mean: 0, median: 0, p95: 0 }
  const sorted = results.map((r) => r.latencyMs).sort((a, b) => a - b)
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length
  return { mean, median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) }
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length))
  return sortedValues[index]
}

export function computePercentWithoutOpenAi(results: EvaluationCaseResult[]): number {
  if (results.length === 0) return 0
  const withoutOpenAi = results.filter((r) => !r.usedOpenAi).length
  return (withoutOpenAi / results.length) * 100
}

export function computeEvaluationMetrics(results: EvaluationCaseResult[]): EvaluationMetrics {
  const latency = computeLatencyStats(results)
  return {
    totalCases: results.length,
    recallAt1: computeRecallAtK(results, 1),
    recallAt3: computeRecallAtK(results, 3),
    recallAt5: computeRecallAtK(results, 5),
    recallAt10: computeRecallAtK(results, 10),
    meanReciprocalRank: computeMeanReciprocalRank(results),
    latencyMeanMs: latency.mean,
    latencyMedianMs: latency.median,
    latencyP95Ms: latency.p95,
    percentSearchesWithoutOpenAi: computePercentWithoutOpenAi(results),
  }
}
