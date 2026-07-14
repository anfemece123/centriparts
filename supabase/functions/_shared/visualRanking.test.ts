import { describe, expect, it } from 'vitest'
import { computeMetadataScore, computeRanking, DEFAULT_RANKING_WEIGHTS } from './visualRanking.ts'

describe('computeRanking', () => {
  it('gives an exact reference match the maximum score and the exact_reference type', () => {
    const result = computeRanking({
      globalVisualSimilarity: 0.2, // even a weak visual signal doesn't matter here
      localVisualSimilarity: null,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: true,
    })
    expect(result.finalScore).toBe(1)
    expect(result.matchType).toBe('exact_reference')
    expect(result.similarityLabel).toBe('Referencia exacta')
  })

  it('never produces exact_reference from visual similarity alone, even at similarity 1', () => {
    const result = computeRanking({
      globalVisualSimilarity: 1,
      localVisualSimilarity: 1,
      metadataScore: 1,
      consensusBonus: 0.025,
      isExactReferenceMatch: false,
    })
    expect(result.matchType).not.toBe('exact_reference')
    expect(result.matchType).toBe('very_high_similarity')
  })

  it('applies the documented weights (0.70 / 0.20 / 0.07 + consensus bonus)', () => {
    const result = computeRanking({
      globalVisualSimilarity: 0.8,
      localVisualSimilarity: 0.6,
      metadataScore: 0.5,
      consensusBonus: 0.02,
      isExactReferenceMatch: false,
    })
    const expected = 0.8 * 0.7 + 0.6 * 0.2 + 0.5 * 0.07 + 0.02
    expect(result.finalScore).toBeCloseTo(expected, 6)
  })

  it('falls back to the global similarity for the local component when local rerank did not run', () => {
    const withNullLocal = computeRanking({
      globalVisualSimilarity: 0.8,
      localVisualSimilarity: null,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })
    const withEqualLocal = computeRanking({
      globalVisualSimilarity: 0.8,
      localVisualSimilarity: 0.8,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })
    expect(withNullLocal.finalScore).toBeCloseTo(withEqualLocal.finalScore, 6)
  })

  it('clamps the final score to at most 1', () => {
    const result = computeRanking({
      globalVisualSimilarity: 1,
      localVisualSimilarity: 1,
      metadataScore: 1,
      consensusBonus: 0.025,
      isExactReferenceMatch: false,
    })
    expect(result.finalScore).toBeLessThanOrEqual(1)
  })

  it('classifies scores into the four non-exact match types in descending score order', () => {
    const veryHigh = computeRanking({
      globalVisualSimilarity: 0.9,
      localVisualSimilarity: 0.9,
      metadataScore: 1,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })
    const high = computeRanking({
      globalVisualSimilarity: 0.85,
      localVisualSimilarity: 0.7,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })
    const possible = computeRanking({
      globalVisualSimilarity: 0.65,
      localVisualSimilarity: 0.6,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })
    const related = computeRanking({
      globalVisualSimilarity: 0.3,
      localVisualSimilarity: 0.2,
      metadataScore: 0,
      consensusBonus: 0,
      isExactReferenceMatch: false,
    })

    expect(veryHigh.matchType).toBe('very_high_similarity')
    expect(veryHigh.similarityLabel).toBe('Muy alta')
    expect(high.matchType).toBe('high_similarity')
    expect(high.similarityLabel).toBe('Alta')
    expect(possible.matchType).toBe('possible_match')
    expect(possible.similarityLabel).toBe('Media')
    expect(related.matchType).toBe('related_product')
    expect(related.similarityLabel).toBe('Relacionada')
  })

  it('uses the documented default weights', () => {
    expect(DEFAULT_RANKING_WEIGHTS).toEqual({
      globalSimilarityWeight: 0.7,
      localSimilarityWeight: 0.2,
      metadataWeight: 0.07,
    })
  })
})

describe('computeMetadataScore', () => {
  it('is zero with no signals', () => {
    expect(computeMetadataScore({ brandDetectedViaOcr: false, referenceHintDetected: false })).toBe(0)
  })

  it('never exceeds 1', () => {
    expect(computeMetadataScore({ brandDetectedViaOcr: true, referenceHintDetected: true })).toBeLessThanOrEqual(1)
  })
})
