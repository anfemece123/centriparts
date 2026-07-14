// Groups raw per-image vector matches into one candidate per product (spec
// section 15). A product with many indexed images must not win purely by
// having more images — the consensus bonus is intentionally small and capped.

import type { RawVisualMatch } from './visualSearchTypes.ts'

export interface GroupedVisualCandidate {
  productId: string
  bestProductImageId: string
  bestSimilarity: number
  matchedImageCount: number
  consensusBonus: number
}

const CONSENSUS_BONUS_PER_IMAGE = 0.005
const CONSENSUS_BONUS_CAP = 0.025

export function groupVisualMatchesByProduct(matches: RawVisualMatch[]): GroupedVisualCandidate[] {
  const byProduct = new Map<string, RawVisualMatch[]>()
  for (const match of matches) {
    const existing = byProduct.get(match.productId)
    if (existing) {
      existing.push(match)
    } else {
      byProduct.set(match.productId, [match])
    }
  }

  const grouped: GroupedVisualCandidate[] = []
  for (const [productId, productMatches] of byProduct) {
    const sorted = [...productMatches].sort((a, b) => b.similarity - a.similarity)
    const best = sorted[0]
    const additionalUsefulImages = sorted.length - 1
    const consensusBonus = Math.min(CONSENSUS_BONUS_CAP, additionalUsefulImages * CONSENSUS_BONUS_PER_IMAGE)

    grouped.push({
      productId,
      bestProductImageId: best.productImageId,
      bestSimilarity: best.similarity,
      matchedImageCount: sorted.length,
      consensusBonus,
    })
  }

  return grouped.sort((a, b) => b.bestSimilarity - a.bestSimilarity)
}
