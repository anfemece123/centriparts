// Reshapes the legacy OpenAI text-embedding pipeline's output into the same
// V2 response contract (spec section 21) the new pixel-embedding pipeline
// returns, so the frontend only ever has to understand one shape — used
// when VISUAL_SEARCH_ENGINE is 'legacy', or 'hybrid' with no visual
// coverage in scope (spec section 26).

import type { ProductDetailRow } from './supabaseSearchPort.ts'
import type { CandidateScore } from './scoring.ts'
import { classifyMatchType, matchTypeToLabel } from './visualRanking.ts'
import { determineResponseStatus } from './visualResponseStatus.ts'
import type { MatchType, VisualProductResultV2, VisualProductSearchResponseV2 } from './visualSearchTypes.ts'

export interface LegacyResultForAdapter {
  detail: ProductDetailRow
  score: CandidateScore
  matchedImageStoragePath: string | null
}

export function buildLegacyResultV2(
  input: LegacyResultForAdapter,
  position: number,
  supabaseUrl: string,
  buildPublicImageUrl: (supabaseUrl: string, storagePath: string) => string,
): VisualProductResultV2 {
  const { detail, score, matchedImageStoragePath } = input

  const matchType: MatchType = score.isExactReferenceMatch ? 'exact_reference' : classifyMatchType(score.finalScore)
  const primaryCategory = detail.categories[0] ?? null

  const primaryImageUrl = detail.primaryImagePath ? buildPublicImageUrl(supabaseUrl, detail.primaryImagePath) : null
  const matchedImagePath = matchedImageStoragePath ?? detail.primaryImagePath
  const matchedImageUrl = matchedImagePath ? buildPublicImageUrl(supabaseUrl, matchedImagePath) : ''

  return {
    position,
    productId: detail.productId,
    ci: detail.ci,
    reference: detail.reference,
    name: detail.name,
    brand: detail.brand,
    categoryId: primaryCategory?.id ?? null,
    categoryName: primaryCategory?.name ?? null,
    primaryImageUrl,
    // The legacy pipeline doesn't track a specific product_image_id for its
    // matched image (only a storage path) — falls back to the product id
    // so the field is never empty; the frontend never displays this raw.
    matchedImageId: detail.productId,
    matchedImageUrl,
    globalVisualSimilarity: score.similarityScore,
    localVisualSimilarity: null,
    metadataScore: 0,
    consensusBonus: 0,
    finalScore: score.finalScore,
    matchType,
    similarityLabel: matchTypeToLabel(matchType),
    compatibilitySummary: detail.compatibilitySummary,
    productUrl: `/p/${detail.productId}`,
  }
}

export function buildLegacyResponseV2(input: {
  searchId: string
  scope: { isGlobalSearch: boolean; selectedCategoryId: string | null; selectedCategoryName: string | null }
  indexedImagesInScope: number
  candidatesRetrieved: number
  results: VisualProductResultV2[]
  hasExactMatch: boolean
  processingTimeMs: number
  usedOpenAi: boolean
  openAiCallCount: number
}): VisualProductSearchResponseV2 {
  return {
    searchId: input.searchId,
    scope: input.scope,
    status: determineResponseStatus({
      indexedImagesInScope: input.indexedImagesInScope,
      hasExactMatch: input.hasExactMatch,
      resultCount: input.results.length,
    }),
    results: input.results,
    meta: {
      engine: 'legacy',
      provider: 'openai-text-embedding',
      model: 'text-embedding-3-large',
      modelVersion: 'legacy',
      indexedImagesInScope: input.indexedImagesInScope,
      rawImagesRetrieved: input.candidatesRetrieved,
      uniqueProductsRetrieved: input.results.length,
      localRerankCandidates: 0,
      resultsReturned: input.results.length,
      usedLocalOcr: false,
      usedLocalReranking: false,
      usedOpenAi: input.usedOpenAi,
      openAiCallCount: input.openAiCallCount,
      processingTimeMs: input.processingTimeMs,
      cacheHit: false,
    },
  }
}
