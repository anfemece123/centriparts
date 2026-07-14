// Shared types for the NEW pixel-embedding visual search pipeline (spec
// section 21). Named with a `V2` suffix to coexist with the legacy
// `VisualProductSearchResponse` in types.ts without a naming collision —
// once `VISUAL_SEARCH_ENGINE=visual` is the only mode left, the legacy
// types can be deleted and this can be renamed.
//
// Imported both by Deno Edge Functions and by Vitest (Node) — keep this
// file free of Deno-specific or Node-specific APIs, same convention as
// types.ts.

export type VisualSearchEngineMode = 'legacy' | 'hybrid' | 'visual'

export type MatchType =
  | 'exact_reference'
  | 'very_high_similarity'
  | 'high_similarity'
  | 'possible_match'
  | 'related_product'

export type SimilarityLabel = 'Referencia exacta' | 'Muy alta' | 'Alta' | 'Media' | 'Relacionada'

export type VisualSearchStatusV2 = 'exact_match' | 'results_found' | 'no_results' | 'not_indexed'

export interface VisualProductResultV2 {
  position: number

  productId: string
  ci: string
  reference: string | null
  name: string
  brand: string | null

  categoryId: string | null
  categoryName: string | null

  primaryImageUrl: string | null
  matchedImageId: string
  matchedImageUrl: string

  globalVisualSimilarity: number
  localVisualSimilarity: number | null
  metadataScore: number
  consensusBonus: number
  finalScore: number

  matchType: MatchType
  similarityLabel: SimilarityLabel

  compatibilitySummary: string[]
  productUrl: string
}

export interface VisualProductSearchResponseV2 {
  searchId: string

  scope: {
    isGlobalSearch: boolean
    selectedCategoryId: string | null
    selectedCategoryName: string | null
  }

  status: VisualSearchStatusV2

  results: VisualProductResultV2[]

  meta: {
    engine: VisualSearchEngineMode
    provider: string
    model: string
    modelVersion: string

    indexedImagesInScope: number
    rawImagesRetrieved: number
    uniqueProductsRetrieved: number
    localRerankCandidates: number
    resultsReturned: number

    usedLocalOcr: boolean
    usedLocalReranking: boolean
    usedOpenAi: boolean
    openAiCallCount: number

    processingTimeMs: number
    cacheHit: boolean
  }
}

/** Raw (un-grouped, un-ranked) row shape returned by
 * match_product_images_by_visual_embedding — one row per matching image,
 * possibly several per product. */
export interface RawVisualMatch {
  productId: string
  productImageId: string
  similarity: number
}
