import { supabase } from '@/lib/supabase'
import type {
  VisualSearchErrorResponse,
  IndexImageOutcome,
  ReindexBatchResult,
  VisualEmbeddingWorkerResult,
  VisualEmbeddingBackfillResult,
  NormalizedVisualSearchResponse,
  NormalizedVisualSearchResult,
} from '@/types'

const FUNCTION_SECRET = import.meta.env.VITE_FUNCTION_SECRET as string | undefined

export type VisualSearchResult =
  | { ok: true; data: NormalizedVisualSearchResponse }
  | { ok: false; error: VisualSearchErrorResponse }

// ============================================================
// Normalizer — the single place that knows about every raw shape
// visual-product-search can return. Nothing outside this file (and its
// test) is allowed to read `.results`/`.candidates`/`.exactMatch` off a raw
// payload — every consumer (the modal, the result card, future hooks) only
// ever sees NormalizedVisualSearchResponse.
//
// Raw shapes handled here:
//   - New V2 contract:    { status, results, scope, meta }
//   - Legacy contract:    { status, exactMatch, candidates, queryAnalysis, scope, meta }
//   - A stale cached payload from either shape, missing fields, or with
//     fields of the wrong type.
//   - A completely malformed/empty payload (never throws — falls back to
//     an empty, renderable response instead of crashing the UI).
// ============================================================

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

const KNOWN_SIMILARITY_LABELS = new Set(['Referencia exacta', 'Muy alta', 'Alta', 'Media', 'Relacionada'])

/** Legacy results (VisualProductResult) used `confidenceLabel` in a
 * different vocabulary (`exacta`/`alta`/`media`/`baja`) — mapped to the new
 * label set so the card never has to know which contract produced it. */
function legacyConfidenceLabelToSimilarityLabel(confidenceLabel: unknown): string | null {
  switch (confidenceLabel) {
    case 'exacta':
      return 'Referencia exacta'
    case 'alta':
      return 'Alta'
    case 'media':
      return 'Media'
    case 'baja':
      return 'Relacionada'
    default:
      return null
  }
}

function normalizeCategoryName(raw: UnknownRecord): string | null {
  if (typeof raw.categoryName === 'string') return raw.categoryName
  // Legacy shape: categories: Array<{ id, name }> — first one wins.
  if (Array.isArray(raw.categories) && raw.categories.length > 0) {
    const first = raw.categories[0]
    if (isRecord(first) && typeof first.name === 'string') return first.name
  }
  return null
}

function normalizeResultItem(raw: unknown): NormalizedVisualSearchResult | null {
  if (!isRecord(raw)) return null
  const productId = asStringOrNull(raw.productId)
  // A result without an id can't link anywhere and can't be deduplicated —
  // drop it rather than render a broken card.
  if (!productId) return null

  const candidateSimilarityLabel =
    asStringOrNull(raw.similarityLabel) ?? legacyConfidenceLabelToSimilarityLabel(raw.confidenceLabel)
  const similarityLabel =
    candidateSimilarityLabel && KNOWN_SIMILARITY_LABELS.has(candidateSimilarityLabel)
      ? candidateSimilarityLabel
      : 'Relacionada'

  const matchType =
    asStringOrNull(raw.matchType) ?? (raw.confidenceLabel === 'exacta' ? 'exact_reference' : 'related_product')

  return {
    productId,
    ci: asString(raw.ci),
    reference: asStringOrNull(raw.reference),
    name: asString(raw.name),
    brand: asStringOrNull(raw.brand),
    primaryImageUrl: asStringOrNull(raw.primaryImageUrl) ?? asStringOrNull(raw.imageUrl),
    matchedImageUrl: asStringOrNull(raw.matchedImageUrl),
    categoryName: normalizeCategoryName(raw),
    compatibilitySummary: asStringArray(raw.compatibilitySummary),
    finalScore: asNumber(raw.finalScore, asNumber(raw.confidence, 0)),
    similarityLabel,
    matchType,
    productUrl: asString(raw.productUrl, `/p/${productId}`),
  }
}

/** Extracts the raw, un-normalized result items regardless of contract:
 * new (`results`), legacy (`exactMatch` + `candidates`), or missing
 * entirely. If `exactMatch` is present it always comes first and is never
 * duplicated even if it also appears inside `candidates`. */
function extractRawResultItems(payload: UnknownRecord): unknown[] {
  if (Array.isArray(payload.results)) return payload.results

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  const exactMatch = isRecord(payload.exactMatch) ? payload.exactMatch : null
  if (!exactMatch) return candidates

  const exactMatchId = exactMatch.productId
  const dedupedCandidates = candidates.filter((candidate) => !isRecord(candidate) || candidate.productId !== exactMatchId)
  return [exactMatch, ...dedupedCandidates]
}

function normalizeStatus(payload: UnknownRecord, hasResults: boolean): NormalizedVisualSearchResponse['status'] {
  switch (payload.status) {
    case 'exact_match':
      return 'exact_match'
    case 'results_found':
      return 'results_found'
    case 'no_results':
      return 'no_results'
    case 'not_indexed':
      return 'not_indexed'
    // Legacy status vocabulary.
    case 'likely_match':
    case 'similar_results':
      return 'results_found'
    case 'no_match':
      return 'no_results'
    default:
      // Unknown/missing status: derive the safest value from what we
      // actually have, instead of guessing a status that contradicts it.
      return hasResults ? 'results_found' : 'no_results'
  }
}

function normalizeScope(payload: UnknownRecord): NormalizedVisualSearchResponse['scope'] {
  const scope = isRecord(payload.scope) ? payload.scope : {}
  return {
    isGlobalSearch: asBoolean(scope.isGlobalSearch, true),
    selectedCategoryId: asStringOrNull(scope.selectedCategoryId),
    selectedCategoryName: asStringOrNull(scope.selectedCategoryName),
  }
}

function normalizeMeta(payload: UnknownRecord): NormalizedVisualSearchResponse['meta'] {
  const meta = isRecord(payload.meta) ? payload.meta : {}
  return {
    processingTimeMs: asNumber(meta.processingTimeMs, 0),
    cacheHit: asBoolean(meta.cacheHit, false),
    usedOpenAi: asBoolean(meta.usedOpenAi, false),
  }
}

/** Turns any raw visual-product-search payload into the one stable shape
 * every UI component is allowed to read. Never throws, never returns
 * `results` as anything but an array — this is what fixes
 * "Cannot read properties of undefined (reading 'map')" at the source
 * instead of papering over it with `?.` at the render site. */
export function normalizeVisualSearchResponse(payload: unknown): NormalizedVisualSearchResponse {
  const record = isRecord(payload) ? payload : {}

  const rawItems = extractRawResultItems(record)
  const results = rawItems
    .map(normalizeResultItem)
    .filter((item): item is NormalizedVisualSearchResult => item !== null)

  return {
    status: normalizeStatus(record, results.length > 0),
    results,
    scope: normalizeScope(record),
    meta: normalizeMeta(record),
  }
}

/** Public: searches the catalog by photo, optionally scoped to a category.
 * Always returns the normalized contract — this is the only place allowed
 * to touch the Edge Function's raw JSON. */
export async function searchProductByImage(params: {
  image: File
  categoryId: string | null
}): Promise<VisualSearchResult> {
  const formData = new FormData()
  formData.append('image', params.image)
  formData.append('categoryId', params.categoryId ?? '')

  const headers: Record<string, string> = {}
  if (FUNCTION_SECRET) headers['x-internal-secret'] = FUNCTION_SECRET

  const { data, error } = await supabase.functions.invoke('visual-product-search', {
    body: formData,
    headers,
  })

  if (error) {
    return {
      ok: false,
      error: {
        error: true,
        code: 'unexpected_error',
        message: 'No se pudo completar la búsqueda. Intenta de nuevo.',
        searchId: null,
      },
    }
  }

  if (isRecord(data) && data.error) {
    return { ok: false, error: data as unknown as VisualSearchErrorResponse }
  }

  return { ok: true, data: normalizeVisualSearchResponse(data) }
}

/** Admin: (re)analyzes a single product image (legacy OpenAI pipeline). */
export async function indexProductImageById(productImageId: string): Promise<IndexImageOutcome> {
  const { data, error } = await supabase.functions.invoke('index-product-image', {
    body: { productImageId },
  })
  if (error) throw error
  return data as IndexImageOutcome
}

/** Admin: processes the next small batch of un-indexed catalog images (legacy OpenAI pipeline). */
export async function reindexCatalogImagesBatch(batchSize = 5): Promise<ReindexBatchResult> {
  const { data, error } = await supabase.functions.invoke('reindex-catalog-images', {
    body: { batchSize },
  })
  if (error) throw error
  return data as ReindexBatchResult
}

/** Admin: claims and processes the next batch of pending/stuck pixel-embedding
 * jobs (new pipeline) — new image uploads already auto-enqueue via a DB
 * trigger, so this is for "process now" / catching up on a schedule gap. */
export async function processVisualEmbeddingBatch(batchSize?: number): Promise<VisualEmbeddingWorkerResult> {
  const { data, error } = await supabase.functions.invoke('visual-embedding-worker', {
    body: batchSize ? { batchSize } : {},
  })
  if (error) throw error
  return data as VisualEmbeddingWorkerResult
}

/** Admin: enqueues pixel-embedding jobs for images that predate the feature
 * or need reprocessing after a model/version bump. Call repeatedly
 * ("Continuar") until enqueuedCount is 0. */
export async function backfillVisualEmbeddings(batchSize?: number): Promise<VisualEmbeddingBackfillResult> {
  const { data, error } = await supabase.functions.invoke('backfill-visual-embeddings', {
    body: { action: 'backfill', ...(batchSize ? { batchSize } : {}) },
  })
  if (error) throw error
  return data as VisualEmbeddingBackfillResult
}

/** Admin: explicitly resets permanently-failed pixel-embedding jobs back to
 * pending — this never happens automatically. */
export async function retryFailedVisualEmbeddings(batchSize?: number): Promise<VisualEmbeddingBackfillResult> {
  const { data, error } = await supabase.functions.invoke('backfill-visual-embeddings', {
    body: { action: 'retry_failed', ...(batchSize ? { batchSize } : {}) },
  })
  if (error) throw error
  return data as VisualEmbeddingBackfillResult
}
