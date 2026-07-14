// Optional, tightly-bounded OpenAI ambiguity tie-break (spec section 18).
// Reuses the existing single-batch-call `rerankVisualCandidates` from
// rerank.ts (already "one call for the whole pool, never one per
// candidate") — this module only decides *whether* that call should
// happen, and how to fold its verdicts back into the ranking.
//
// Never runs when: a deterministic reference match already exists, there
// are fewer than 2 candidates, the result came from cache, the feature is
// disabled, or the top result already clearly beats the runner-up.

import type { RerankCandidateResult } from './types.ts'
import type { VisualEngineConfig } from './config.ts'
import { classifyMatchType, matchTypeToLabel } from './visualRanking.ts'
import type { MatchType, SimilarityLabel } from './visualSearchTypes.ts'

export interface TiebreakCandidate {
  productId: string
  finalScore: number
  matchType: MatchType
  similarityLabel: SimilarityLabel
}

export function shouldRunOpenAiTiebreak(
  candidates: Pick<TiebreakCandidate, 'finalScore'>[],
  config: Pick<VisualEngineConfig, 'openAiEnabled' | 'openAiRerankEnabled' | 'openAiScoreMargin'>,
): boolean {
  if (!config.openAiEnabled || !config.openAiRerankEnabled) return false
  if (candidates.length < 2) return false
  const [top, runnerUp] = candidates
  return top.finalScore - runnerUp.finalScore <= config.openAiScoreMargin
}

export function selectTiebreakPool<T>(candidates: T[], maxCandidates: number): T[] {
  return candidates.slice(0, Math.max(0, maxCandidates))
}

const EXACT_VERDICT_SCORE_FLOOR = 0.9
const NOT_MATCH_PENALTY = 0.85

/** Applies OpenAI verdicts as a bounded nudge, then re-sorts. Never
 * produces `exact_reference` — that classification is reserved exclusively
 * for a deterministic CI/OEM/reference match (see visualRanking.ts). */
export function applyOpenAiVerdicts<T extends TiebreakCandidate>(
  candidates: T[],
  verdicts: Map<string, RerankCandidateResult>,
): T[] {
  const adjusted = candidates.map((candidate) => {
    const verdict = verdicts.get(candidate.productId)
    if (!verdict) return candidate

    let finalScore = candidate.finalScore
    if (verdict.verdict === 'exact' && verdict.contradictions.length === 0) {
      finalScore = Math.max(finalScore, EXACT_VERDICT_SCORE_FLOOR)
    } else if (verdict.verdict === 'not_match') {
      finalScore = finalScore * NOT_MATCH_PENALTY
    }

    const matchType = candidate.matchType === 'exact_reference' ? candidate.matchType : classifyMatchType(finalScore)
    return { ...candidate, finalScore, matchType, similarityLabel: matchTypeToLabel(matchType) }
  })

  return adjusted.sort((a, b) => b.finalScore - a.finalScore)
}
