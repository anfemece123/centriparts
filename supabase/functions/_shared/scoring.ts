import type { RerankCandidateResult, RerankVerdict, VisualSearchStatus } from './types.ts'
import type { VisualSearchConfig } from './config.ts'

// Base visual score per verdict returned by the reranking model. "exact"
// still isn't enough on its own to become an exact_match result — that
// also requires no contradictions and no close competing candidate.
const VERDICT_BASE_SCORE: Record<RerankVerdict, number> = {
  exact: 0.97,
  probable: 0.83,
  similar: 0.68,
  not_match: 0.15,
}

export interface CandidateForScoring {
  productId: string
  /** Cosine similarity from vector retrieval, 0 when not applicable. */
  similarityScore: number
  /** Null when the candidate came only from a deterministic reference match. */
  rerank: RerankCandidateResult | null
  isExactReferenceMatch: boolean
}

export interface CandidateScore {
  productId: string
  similarityScore: number
  visualScore: number
  finalScore: number
  hasContradictions: boolean
  verdict: RerankVerdict | null
  isExactReferenceMatch: boolean
}

export function calculateVisualSearchScore(candidate: CandidateForScoring): CandidateScore {
  const rerank = candidate.rerank

  // Deterministic reference/OEM match with no visual rerank performed
  // (Etapa C found it before Etapa D/E ever ran).
  if (candidate.isExactReferenceMatch && !rerank) {
    return {
      productId: candidate.productId,
      similarityScore: candidate.similarityScore,
      visualScore: 1,
      finalScore: 1,
      hasContradictions: false,
      verdict: null,
      isExactReferenceMatch: true,
    }
  }

  const visualScore = rerank ? VERDICT_BASE_SCORE[rerank.verdict] : 0
  const hasContradictions = Boolean(rerank && rerank.contradictions.length > 0)

  const matchSignalCount = rerank
    ? [
        rerank.reference_match,
        rerank.brand_match,
        rerank.shape_match,
        rerank.connector_match,
        rerank.mounting_match,
        rerank.visible_text_match,
      ].filter(Boolean).length
    : 0

  // Visual verdict dominates the score; similarity acts as a tie-breaker
  // and sanity check rather than the primary signal.
  let finalScore = visualScore * 0.7 + candidate.similarityScore * 0.3

  if (candidate.isExactReferenceMatch) {
    finalScore = Math.max(finalScore, 0.9)
  }

  if (hasContradictions) {
    finalScore *= matchSignalCount >= 3 ? 0.85 : 0.6
  }

  finalScore = Math.min(1, Math.max(0, finalScore))

  return {
    productId: candidate.productId,
    similarityScore: candidate.similarityScore,
    visualScore,
    finalScore,
    hasContradictions,
    verdict: rerank?.verdict ?? null,
    isExactReferenceMatch: candidate.isExactReferenceMatch,
  }
}

export interface ClassificationResult {
  status: VisualSearchStatus
  exactMatchProductId: string | null
}

type ClassificationThresholds = Pick<
  VisualSearchConfig,
  'exactThreshold' | 'likelyThreshold' | 'similarThreshold' | 'closeResultMargin'
>

/**
 * Classifies a set of scored candidates into the final search status.
 * A generic-looking part can never become exact_match: that requires
 * either a deterministic reference match or an explicit "exact" verdict
 * from the reranker, with no contradictions and no close competitor.
 */
export function classifyVisualSearchResult(
  scored: CandidateScore[],
  thresholds: ClassificationThresholds,
): ClassificationResult {
  if (scored.length === 0) {
    return { status: 'no_match', exactMatchProductId: null }
  }

  const sorted = [...scored].sort((a, b) => b.finalScore - a.finalScore)
  const top = sorted[0]
  const runnerUp = sorted[1]

  const isCloseCall = Boolean(
    runnerUp && top.finalScore - runnerUp.finalScore <= thresholds.closeResultMargin,
  )

  const canBeExact =
    top.finalScore >= thresholds.exactThreshold &&
    !top.hasContradictions &&
    (top.isExactReferenceMatch || top.verdict === 'exact') &&
    !isCloseCall

  if (canBeExact) {
    return { status: 'exact_match', exactMatchProductId: top.productId }
  }

  if (top.finalScore >= thresholds.likelyThreshold && !isCloseCall) {
    return { status: 'likely_match', exactMatchProductId: null }
  }

  if (top.finalScore >= thresholds.similarThreshold) {
    return { status: 'similar_results', exactMatchProductId: null }
  }

  return { status: 'no_match', exactMatchProductId: null }
}
