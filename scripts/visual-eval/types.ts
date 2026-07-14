// Types for the real-photo evaluation harness (spec sections 7/29).
// A "case" is one query photo with the ground truth of which catalog
// product it should return as the top (or near-top) match.

export interface VisualSearchEvaluationCase {
  queryImagePath: string
  expectedProductId: string
  categoryId: string | null
  notes?: string
}

export interface EvaluationManifest {
  /** Free-text label for this run, e.g. "dinov2-small-v1" — shows up in the report. */
  label: string
  cases: VisualSearchEvaluationCase[]
}

export interface EvaluationCaseResult {
  case: VisualSearchEvaluationCase
  /** 1-based rank of expectedProductId within the returned results, or
   * null if it wasn't returned at all (or the request failed). */
  rank: number | null
  latencyMs: number
  usedOpenAi: boolean
  cacheHit: boolean
  errorMessage?: string
}

export interface EvaluationMetrics {
  totalCases: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  recallAt10: number
  meanReciprocalRank: number
  latencyMeanMs: number
  latencyMedianMs: number
  latencyP95Ms: number
  percentSearchesWithoutOpenAi: number
}

export interface EvaluationReport {
  label: string
  generatedAt: string
  metrics: EvaluationMetrics
  caseResults: EvaluationCaseResult[]
}
