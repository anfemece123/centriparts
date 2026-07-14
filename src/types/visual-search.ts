// Frontend contract types for the visual product search feature.
// Mirrors supabase/functions/_shared/types.ts — duplicated intentionally:
// the Edge Functions run on Deno and are not part of this Vite/TS project,
// so the contract is kept in sync manually across that boundary.

export type ImageQuality = 'excellent' | 'good' | 'limited' | 'poor'
export type VisualSearchStatus = 'exact_match' | 'likely_match' | 'similar_results' | 'no_match'
export type ConfidenceLabel = 'exacta' | 'alta' | 'media' | 'baja'

export interface VisualProductResult {
  productId: string
  ci: string
  name: string
  brand: string | null
  categories: Array<{ id: string; name: string }>
  imageUrl: string | null
  matchedImageUrl: string | null
  confidence: number
  confidenceLabel: ConfidenceLabel
  evidence: string[]
  contradictions: string[]
  similarityScore: number
  visualScore: number
  finalScore: number
  compatibilitySummary: string[]
  productUrl: string
  salePrice: number
  stock: number
}

export interface VisualProductSearchResponse {
  searchId: string
  status: VisualSearchStatus

  scope: {
    isGlobalSearch: boolean
    selectedCategoryId: string | null
    selectedCategoryName: string | null
    includedCategoryIds: string[]
  }

  queryAnalysis: {
    partType: string | null
    categoryGuess: string | null
    brandVisible: string | null
    referenceCodes: string[]
    imageQuality: ImageQuality
    warnings: string[]
  }

  exactMatch: VisualProductResult | null
  candidates: VisualProductResult[]

  meta: {
    indexedImagesInScope: number
    candidatesRetrieved: number
    candidatesReranked: number
    processingTimeMs: number
    modelVersion: string
    resultCount: number
  }
}

export type VisualSearchErrorCode =
  | 'invalid_category'
  | 'inactive_category'
  | 'category_without_products'
  | 'category_without_indexed_images'
  | 'invalid_file'
  | 'file_too_large'
  | 'not_an_automotive_part'
  | 'no_indexed_images'
  | 'no_match'
  | 'openai_unavailable'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'storage_error'
  | 'database_error'
  | 'unexpected_error'

export interface VisualSearchErrorResponse {
  error: true
  code: VisualSearchErrorCode
  message: string
  searchId: string | null
}

export interface CategoryTreeNode {
  id: string
  name: string
  depth: number
  children: CategoryTreeNode[]
}

export type IndexingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ProductImageAnalysisSummary {
  productImageId: string
  status: IndexingStatus
  analyzedAt: string | null
  errorMessage: string | null
  attemptCount: number
  detectedReferenceCodes: string[]
  detectedOemCodes: string[]
  analysisConfidence: number | null
}

export interface IndexImageOutcome {
  productImageId: string
  status: 'completed' | 'skipped' | 'failed'
  reason?: string
}

export interface ReindexBatchResult {
  processedCount: number
  succeeded: number
  failed: number
  remainingCount: number
  results: IndexImageOutcome[]
}

export interface CategoryIndexingStat {
  categoryId: string
  categoryName: string
  productsWithImages: number
  imagesIndexed: number
  imagesPending: number
  imagesFailed: number
}

// ============================================================
// V2 contract — pixel-embedding visual search engine.
// Mirrors supabase/functions/_shared/visualSearchTypes.ts. This is what
// visual-product-search now returns for every engine mode (legacy results
// are reshaped into this same contract server-side), so the frontend only
// ever has to understand one response shape.
// ============================================================

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
    engine: string
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

export interface VisualEmbeddingCoverageStats {
  totalImages: number
  indexedImages: number
  pendingImages: number
  processingImages: number
  failedImages: number
  activeProvider: string | null
  activeModel: string | null
  activeModelVersion: string | null
}

export interface VisualEmbeddingWorkerResult {
  claimed: number
  completed: number
  failed: number
}

export interface VisualEmbeddingBackfillResult {
  action: 'backfill' | 'retry_failed'
  enqueuedCount: number
  retriedCount: number
  remainingPendingCount: number
  remainingFailedCount: number
}

// ============================================================
// Normalized contract — the ONLY shape UI components are allowed to read.
//
// visual-product-search can currently answer with at least three different
// raw shapes depending on engine/version/cache state: the new V2 contract
// (`status`/`results`/`scope`/`meta`), the legacy contract
// (`exactMatch`/`candidates`/`queryAnalysis`), or a stale cached payload
// written by an older deployment. Components must never branch on which of
// these arrived — `normalizeVisualSearchResponse` (visual-search.service.ts)
// is the single place that inspects the raw payload and always produces
// this shape, with every array guaranteed to be a real array.
// ============================================================

export type NormalizedVisualSearchStatus = 'exact_match' | 'results_found' | 'no_results' | 'not_indexed'

export interface NormalizedVisualSearchResult {
  productId: string
  ci: string
  reference: string | null
  name: string
  brand: string | null

  primaryImageUrl: string | null
  matchedImageUrl: string | null

  categoryName: string | null
  compatibilitySummary: string[]

  finalScore: number
  similarityLabel: string
  matchType: string

  productUrl: string
}

export interface NormalizedVisualSearchResponse {
  status: NormalizedVisualSearchStatus

  results: NormalizedVisualSearchResult[]

  scope: {
    isGlobalSearch: boolean
    selectedCategoryId: string | null
    selectedCategoryName: string | null
  }

  meta: {
    processingTimeMs: number
    cacheHit: boolean
    usedOpenAi: boolean
  }
}
