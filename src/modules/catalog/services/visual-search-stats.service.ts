import { supabase } from '@/lib/supabase'
import { listCategories } from './categories.service'
import type {
  ProductImageAnalysisSummary,
  CategoryIndexingStat,
  IndexingStatus,
  VisualEmbeddingCoverageStats,
} from '@/types'

/** Analysis status for a specific set of product images (admin product page). */
export async function getImageAnalysisSummaries(
  productImageIds: string[],
): Promise<Map<string, ProductImageAnalysisSummary>> {
  const result = new Map<string, ProductImageAnalysisSummary>()
  if (productImageIds.length === 0) return result

  const { data, error } = await supabase
    .from('product_image_ai_features')
    .select(
      'product_image_id, status, analyzed_at, error_message, attempt_count, detected_reference_codes, detected_oem_codes, analysis_confidence',
    )
    .in('product_image_id', productImageIds)

  if (error) throw error

  for (const row of (data ?? []) as Array<{
    product_image_id: string
    status: IndexingStatus
    analyzed_at: string | null
    error_message: string | null
    attempt_count: number
    detected_reference_codes: string[] | null
    detected_oem_codes: string[] | null
    analysis_confidence: number | null
  }>) {
    result.set(row.product_image_id, {
      productImageId: row.product_image_id,
      status: row.status,
      analyzedAt: row.analyzed_at,
      errorMessage: row.error_message,
      attemptCount: row.attempt_count,
      detectedReferenceCodes: row.detected_reference_codes ?? [],
      detectedOemCodes: row.detected_oem_codes ?? [],
      analysisConfidence: row.analysis_confidence,
    })
  }

  return result
}

/**
 * Per-category indexing coverage for the admin AI panel: how many products
 * have images, how many images are indexed/pending/failed. Loaded once for
 * the whole panel — not on any hot path — so a few aggregate queries plus
 * in-memory grouping is preferable to N+1 per-category round trips.
 */
export async function getCategoryIndexingStats(): Promise<CategoryIndexingStat[]> {
  const [categories, productCategoryRows, imageRows, featureRows] = await Promise.all([
    listCategories(),
    fetchAll('product_categories', 'product_id, category_id'),
    fetchAll('product_images', 'id, product_id'),
    fetchAll('product_image_ai_features', 'product_image_id, status'),
  ])

  const featureStatusByImageId = new Map<string, IndexingStatus>()
  for (const row of featureRows as Array<{ product_image_id: string; status: IndexingStatus }>) {
    featureStatusByImageId.set(row.product_image_id, row.status)
  }

  const imageIdsByProductId = new Map<string, string[]>()
  for (const row of imageRows as Array<{ id: string; product_id: string }>) {
    const ids = imageIdsByProductId.get(row.product_id) ?? []
    ids.push(row.id)
    imageIdsByProductId.set(row.product_id, ids)
  }

  const productIdsByCategoryId = new Map<string, Set<string>>()
  for (const row of productCategoryRows as Array<{ product_id: string; category_id: string }>) {
    const set = productIdsByCategoryId.get(row.category_id) ?? new Set<string>()
    set.add(row.product_id)
    productIdsByCategoryId.set(row.category_id, set)
  }

  return categories.map((category) => {
    const productIds = Array.from(productIdsByCategoryId.get(category.id) ?? [])
    let productsWithImages = 0
    let imagesIndexed = 0
    let imagesPending = 0
    let imagesFailed = 0

    for (const productId of productIds) {
      const imageIds = imageIdsByProductId.get(productId) ?? []
      if (imageIds.length > 0) productsWithImages += 1

      for (const imageId of imageIds) {
        const status = featureStatusByImageId.get(imageId)
        if (status === 'completed') imagesIndexed += 1
        else if (status === 'failed') imagesFailed += 1
        else imagesPending += 1
      }
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      productsWithImages,
      imagesIndexed,
      imagesPending,
      imagesFailed,
    }
  })
}

/** Coverage of the NEW pixel-embedding pipeline (spec section 25): total
 * images, how many are indexed/pending/processing/failed, and the currently
 * active model — independent of the legacy OpenAI pipeline's stats above. */
export async function getVisualEmbeddingCoverageStats(): Promise<VisualEmbeddingCoverageStats> {
  const [statusRows, configRow] = await Promise.all([
    fetchAll('product_image_visual_embeddings', 'status'),
    supabase
      .from('visual_embedding_active_config')
      .select('provider, model, model_version')
      .eq('id', true)
      .maybeSingle(),
  ])

  let indexedImages = 0
  let pendingImages = 0
  let processingImages = 0
  let failedImages = 0
  for (const row of statusRows as Array<{ status: IndexingStatus }>) {
    if (row.status === 'completed') indexedImages += 1
    else if (row.status === 'pending') pendingImages += 1
    else if (row.status === 'processing') processingImages += 1
    else if (row.status === 'failed') failedImages += 1
  }

  const config = configRow.data as { provider: string; model: string; model_version: string } | null

  return {
    totalImages: statusRows.length,
    indexedImages,
    pendingImages,
    processingImages,
    failedImages,
    activeProvider: config?.provider ?? null,
    activeModel: config?.model ?? null,
    activeModelVersion: config?.model_version ?? null,
  }
}

async function fetchAll(table: string, columns: string): Promise<Record<string, unknown>[]> {
  const pageSize = 1000
  const results: Record<string, unknown>[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    results.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return results
}
