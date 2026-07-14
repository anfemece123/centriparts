// Shared types for the visual product search feature.
// Imported both by Deno Edge Functions and by Vitest (Node) — keep this
// file free of Deno-specific or Node-specific APIs.

export type ImageQuality = 'excellent' | 'good' | 'limited' | 'poor'

export interface AutomotivePartImageAnalysis {
  isAutomotivePart: boolean
  imageQuality: ImageQuality
  viewAngle: string | null
  partType: string | null
  categoryGuess: string | null
  brandVisible: string | null
  manufacturerVisible: string | null
  referenceCodes: string[]
  oemCodes: string[]
  barcodes: string[]
  printedText: string[]
  materials: string[]
  colors: string[]
  generalShape: string | null
  connectorCount: number | null
  connectorType: string | null
  mountingPoints: string[]
  holesAndThreads: string[]
  distinctiveFeatures: string[]
  visibleDamageOrWear: string[]
  searchDescription: string
  warnings: string[]
}

export type VisualSearchStatus = 'exact_match' | 'likely_match' | 'similar_results' | 'no_match'

export type ConfidenceLabel = 'exacta' | 'alta' | 'media' | 'baja'

export type RerankVerdict = 'exact' | 'probable' | 'similar' | 'not_match'

export interface RerankCandidateResult {
  product_id: string
  verdict: RerankVerdict
  confidence: number
  decisive_matches: string[]
  contradictions: string[]
  reference_match: boolean
  brand_match: boolean
  shape_match: boolean
  connector_match: boolean
  mounting_match: boolean
  visible_text_match: boolean
}

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
  /** Public catalog data (spec section 2): price and stock availability. */
  salePrice: number
  stock: number
}

export interface CategoryScope {
  selectedCategoryId: string | null
  includedCategoryIds: string[]
  isGlobalSearch: boolean
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

export interface ScoredCandidate {
  productId: string
  similarityScore: number
  visualScore: number
  finalScore: number
  hasContradictions: boolean
  verdict: RerankVerdict | null
}
