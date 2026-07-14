// Centralized, configurable ranking (spec section 19-20). One file, one set
// of weights — calibratable later against real photos without hunting
// through the pipeline for scattered magic numbers.

import type { MatchType, SimilarityLabel } from './visualSearchTypes.ts'

export interface RankingWeights {
  globalSimilarityWeight: number
  localSimilarityWeight: number
  metadataWeight: number
}

// global*0.70 + local*0.20 + metadata*0.07 (+ consensus_bonus, added
// separately, already capped at 0.025 by visualGrouping.ts) — matches spec
// section 19 exactly. Intentionally not normalized to sum to 1: the
// consensus bonus is meant to be a small nudge on top, not a fourth
// weighted component.
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  globalSimilarityWeight: 0.7,
  localSimilarityWeight: 0.2,
  metadataWeight: 0.07,
}

// Bumping this invalidates the search cache (see visualCache.ts) — any
// change to the weights or classification thresholds changes the meaning of
// a previously-cached response.
export const RANKING_VERSION = 'v1'

const MATCH_TYPE_THRESHOLDS = {
  veryHigh: 0.85,
  high: 0.7,
  possible: 0.5,
}

export interface RankingInput {
  globalVisualSimilarity: number
  /** null when this candidate fell outside the local-rerank pool
   * (VISUAL_LOCAL_RERANK_CANDIDATES), or local rerank is disabled/unavailable. */
  localVisualSimilarity: number | null
  /** 0..1, see computeMetadataScore. */
  metadataScore: number
  /** 0..0.025, see visualGrouping.ts. */
  consensusBonus: number
  /** A deterministic CI/OEM/reference match (spec section 10 priority) —
   * overrides everything else and is the only path that can produce
   * `exact_reference`. Visual similarity alone must never produce it. */
  isExactReferenceMatch: boolean
}

export interface RankingResult {
  finalScore: number
  matchType: MatchType
  similarityLabel: SimilarityLabel
}

export function computeRanking(input: RankingInput, weights: RankingWeights = DEFAULT_RANKING_WEIGHTS): RankingResult {
  if (input.isExactReferenceMatch) {
    return { finalScore: 1, matchType: 'exact_reference', similarityLabel: 'Referencia exacta' }
  }

  // Candidates outside the local-rerank pool fall back to their global
  // similarity for the local component, rather than being penalized for
  // simply not being in the (small, bounded) rerank pool.
  const localComponent = input.localVisualSimilarity ?? input.globalVisualSimilarity

  const rawScore =
    input.globalVisualSimilarity * weights.globalSimilarityWeight +
    localComponent * weights.localSimilarityWeight +
    input.metadataScore * weights.metadataWeight +
    input.consensusBonus

  const finalScore = Math.min(1, Math.max(0, rawScore))
  const matchType = classifyMatchType(finalScore)
  return { finalScore, matchType, similarityLabel: matchTypeToLabel(matchType) }
}

/** Exported so other adapters (e.g. legacyResultAdapter.ts, which maps the
 * legacy OpenAI-scored pipeline into the same V2 contract) classify scores
 * with the exact same thresholds instead of duplicating magic numbers. */
export function classifyMatchType(finalScore: number): MatchType {
  if (finalScore >= MATCH_TYPE_THRESHOLDS.veryHigh) return 'very_high_similarity'
  if (finalScore >= MATCH_TYPE_THRESHOLDS.high) return 'high_similarity'
  if (finalScore >= MATCH_TYPE_THRESHOLDS.possible) return 'possible_match'
  return 'related_product'
}

export function matchTypeToLabel(matchType: MatchType): SimilarityLabel {
  switch (matchType) {
    case 'exact_reference':
      return 'Referencia exacta'
    case 'very_high_similarity':
      return 'Muy alta'
    case 'high_similarity':
      return 'Alta'
    case 'possible_match':
      return 'Media'
    case 'related_product':
      return 'Relacionada'
  }
}

export interface MetadataScoreInput {
  /** OCR text on the query photo mentions the candidate's brand name. */
  brandDetectedViaOcr: boolean
  /** OCR found an alphanumeric fragment consistent with (but not a full
   * viable match for) the candidate's reference/CI — a soft hint only. */
  referenceHintDetected: boolean
}

// Deliberately simple and documented as calibratable (spec section 19)
// rather than over-built ahead of having real photos to calibrate against.
export function computeMetadataScore(input: MetadataScoreInput): number {
  let score = 0
  if (input.brandDetectedViaOcr) score += 0.6
  if (input.referenceHintDetected) score += 0.4
  return Math.min(1, score)
}
