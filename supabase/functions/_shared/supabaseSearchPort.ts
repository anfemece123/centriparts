// deno-lint-ignore-file no-explicit-any
// Deno-only: database/storage access for the visual-product-search Edge
// Function. Kept separate from the pure pipeline logic in _shared so that
// logic stays runtime-agnostic and testable.
import { bytesToBase64, bytesToDataUrl } from './imageProcessing.ts'
import type { ExactMatchCandidate } from './exactMatch.ts'
import type { VectorMatchRow, VectorSearchParams } from './vectorSearch.ts'
import type { RawVisualMatch, VisualProductSearchResponseV2 } from './visualSearchTypes.ts'

const BUCKET = 'product-images'
// Bounded, category-scoped scan for deterministic matching. This is a
// single lightweight indexed SELECT against our own database (no images,
// no OpenAI calls) — not the "send the whole catalog to OpenAI" pattern
// the spec forbids. Real catalogs are expected to stay well under this.
const EXACT_MATCH_SCAN_LIMIT = 5000

export interface ProductDetailRow {
  productId: string
  ci: string
  /** Added for reuse by legacyResultAdapter.ts — does not change any
   * existing legacy behavior, since VisualProductResult never surfaced it. */
  reference: string | null
  name: string
  brand: string | null
  categories: Array<{ id: string; name: string }>
  primaryImagePath: string | null
  compatibilitySummary: string[]
  salePrice: number
  stock: number
}

export interface ProductDetailRowV2 {
  productId: string
  ci: string
  reference: string | null
  name: string
  brand: string | null
  categoryId: string | null
  categoryName: string | null
  primaryImagePath: string | null
  compatibilitySummary: string[]
}

export interface SearchEventInput {
  categoryId: string | null
  includedCategoryCount: number
  isGlobalSearch: boolean
  status: 'exact_match' | 'likely_match' | 'similar_results' | 'no_match' | 'error'
  errorCode?: string | null
  candidatesRetrieved: number
  candidatesReranked: number
  processingTimeMs: number
  visionModel?: string | null
  embeddingModel?: string | null
  ipHash: string | null
}

export function createSearchDbPort(supabase: any) {
  return {
    async getCategory(id: string) {
      const { data, error } = await supabase
        .from('categories')
        .select('id, is_active, name')
        .eq('id', id)
        .maybeSingle()
      if (error) return null
      return data as { id: string; is_active: boolean; name: string } | null
    },

    async getCategoryDescendantIds(id: string): Promise<string[]> {
      const { data, error } = await supabase.rpc('get_category_descendants', { p_category_id: id })
      if (error) throw new Error('database_error')
      return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    },

    async countProductsInScope(categoryIds: string[] | null): Promise<number> {
      if (categoryIds === null) {
        const { count, error } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')
        if (error) throw new Error('database_error')
        return count ?? 0
      }
      const { data, error } = await supabase
        .from('product_categories')
        .select('product_id')
        .in('category_id', categoryIds)
      if (error) throw new Error('database_error')
      return new Set((data ?? []).map((r: any) => r.product_id)).size
    },

    async countIndexedImagesInScope(categoryIds: string[] | null): Promise<number> {
      if (categoryIds === null) {
        const { count, error } = await supabase
          .from('product_image_ai_features')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
        if (error) throw new Error('database_error')
        return count ?? 0
      }
      const { data: scoped, error: scopedError } = await supabase
        .from('product_categories')
        .select('product_id')
        .in('category_id', categoryIds)
      if (scopedError) throw new Error('database_error')
      const productIds = Array.from(new Set((scoped ?? []).map((r: any) => r.product_id)))
      if (productIds.length === 0) return 0

      const { count, error } = await supabase
        .from('product_image_ai_features')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .in('product_id', productIds)
      if (error) throw new Error('database_error')
      return count ?? 0
    },

    async fetchExactMatchCandidates(categoryIds: string[] | null): Promise<ExactMatchCandidate[]> {
      let productIdsInScope: string[] | null = null
      if (categoryIds !== null) {
        const { data, error } = await supabase
          .from('product_categories')
          .select('product_id')
          .in('category_id', categoryIds)
        if (error) throw new Error('database_error')
        productIdsInScope = Array.from(new Set((data ?? []).map((r: any) => r.product_id)))
        if (productIdsInScope.length === 0) return []
      }

      let query = supabase
        .from('products')
        .select('id, ci, reference, product_categories(category_id)')
        .eq('status', 'published')
        .limit(EXACT_MATCH_SCAN_LIMIT)

      if (productIdsInScope) query = query.in('id', productIdsInScope)

      const { data, error } = await query
      if (error) throw new Error('database_error')

      const candidates: ExactMatchCandidate[] = (data ?? []).map((row: any) => ({
        productId: row.id,
        ci: row.ci,
        reference: row.reference,
        oemCodes: [],
        categoryIds: (row.product_categories ?? []).map((pc: any) => pc.category_id),
      }))

      const oemByProduct = await this.fetchOemCodesByProduct(candidates.map((c) => c.productId))
      for (const candidate of candidates) {
        candidate.oemCodes = oemByProduct.get(candidate.productId) ?? []
      }

      return candidates
    },

    async fetchOemCodesByProduct(productIds: string[]): Promise<Map<string, string[]>> {
      if (productIds.length === 0) return new Map()
      const { data, error } = await supabase
        .from('product_image_ai_features')
        .select('product_id, detected_oem_codes')
        .eq('status', 'completed')
        .in('product_id', productIds)
      if (error) return new Map()

      const map = new Map<string, string[]>()
      for (const row of (data ?? []) as Array<{ product_id: string; detected_oem_codes: string[] }>) {
        const existing = map.get(row.product_id) ?? []
        map.set(row.product_id, existing.concat(row.detected_oem_codes ?? []))
      }
      return map
    },

    async matchByEmbedding(params: VectorSearchParams): Promise<VectorMatchRow[]> {
      const { data, error } = await supabase.rpc('match_product_images_by_embedding', {
        query_embedding: params.queryEmbedding,
        category_ids: params.categoryIds,
        match_count: params.matchCount,
        minimum_similarity: params.minimumSimilarity,
      })
      if (error) throw new Error('database_error')
      return (data ?? []) as VectorMatchRow[]
    },

    async fetchProductDetails(productIds: string[]): Promise<Map<string, ProductDetailRow>> {
      const map = new Map<string, ProductDetailRow>()
      if (productIds.length === 0) return map

      const { data, error } = await supabase
        .from('products')
        .select(
          `
          id, ci, reference, base_name, display_name, sale_price, stock,
          brand:brand_id ( name ),
          categories:product_categories ( category:category_id ( id, name ) ),
          images:product_images ( storage_path, is_primary, display_order ),
          compatibility:product_compatibility (
            year_from, year_to,
            vehicle_brand:vehicle_brand_id ( name ),
            vehicle_model:vehicle_model_id ( name )
          )
          `,
        )
        .in('id', productIds)

      if (error) throw new Error('database_error')

      for (const row of (data ?? []) as any[]) {
        const images = (row.images ?? []) as Array<{
          storage_path: string
          is_primary: boolean
          display_order: number
        }>
        const sortedImages = [...images].sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
          return a.display_order - b.display_order
        })

        const compatibilitySummary = (row.compatibility ?? [])
          .map((c: any) => {
            const vehicle = [c.vehicle_brand?.name, c.vehicle_model?.name].filter(Boolean).join(' ')
            const years = [c.year_from, c.year_to].filter((y: unknown) => y !== null).join('-')
            return [vehicle, years].filter(Boolean).join(' ')
          })
          .filter((s: string) => s.length > 0)

        map.set(row.id, {
          productId: row.id,
          ci: row.ci,
          reference: row.reference ?? null,
          name: row.display_name ?? row.base_name,
          brand: row.brand?.name ?? null,
          categories: (row.categories ?? [])
            .map((c: any) => c.category)
            .filter((c: any): c is { id: string; name: string } => Boolean(c)),
          primaryImagePath: sortedImages[0]?.storage_path ?? null,
          compatibilitySummary,
          salePrice: row.sale_price,
          stock: row.stock,
        })
      }

      return map
    },

    async fetchProductDetailsV2(productIds: string[]): Promise<Map<string, ProductDetailRowV2>> {
      const map = new Map<string, ProductDetailRowV2>()
      if (productIds.length === 0) return map

      const { data, error } = await supabase
        .from('products')
        .select(
          `
          id, ci, reference, base_name, display_name,
          brand:brand_id ( name ),
          categories:product_categories ( is_primary, category:category_id ( id, name ) ),
          images:product_images ( storage_path, is_primary, display_order ),
          compatibility:product_compatibility (
            year_from, year_to,
            vehicle_brand:vehicle_brand_id ( name ),
            vehicle_model:vehicle_model_id ( name )
          )
          `,
        )
        .in('id', productIds)

      if (error) throw new Error('database_error')

      for (const row of (data ?? []) as any[]) {
        const images = (row.images ?? []) as Array<{
          storage_path: string
          is_primary: boolean
          display_order: number
        }>
        const sortedImages = [...images].sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
          return a.display_order - b.display_order
        })

        const categories = (row.categories ?? []) as Array<{
          is_primary: boolean
          category: { id: string; name: string } | null
        }>
        const primaryCategory = categories.find((c) => c.is_primary && c.category)?.category ?? categories[0]?.category ?? null

        const compatibilitySummary = (row.compatibility ?? [])
          .map((c: any) => {
            const vehicle = [c.vehicle_brand?.name, c.vehicle_model?.name].filter(Boolean).join(' ')
            const years = [c.year_from, c.year_to].filter((y: unknown) => y !== null).join('-')
            return [vehicle, years].filter(Boolean).join(' ')
          })
          .filter((s: string) => s.length > 0)

        map.set(row.id, {
          productId: row.id,
          ci: row.ci,
          reference: row.reference ?? null,
          name: row.display_name ?? row.base_name,
          brand: row.brand?.name ?? null,
          categoryId: primaryCategory?.id ?? null,
          categoryName: primaryCategory?.name ?? null,
          primaryImagePath: sortedImages[0]?.storage_path ?? null,
          compatibilitySummary,
        })
      }

      return map
    },

    async fetchImageStoragePaths(productImageIds: string[]): Promise<Map<string, string>> {
      const map = new Map<string, string>()
      if (productImageIds.length === 0) return map
      const { data, error } = await supabase.from('product_images').select('id, storage_path').in('id', productImageIds)
      if (error) throw new Error('database_error')
      for (const row of (data ?? []) as Array<{ id: string; storage_path: string }>) {
        map.set(row.id, row.storage_path)
      }
      return map
    },

    async matchByVisualEmbedding(params: {
      queryEmbedding: number[]
      categoryIds: string[] | null
      provider: string
      model: string
      modelVersion: string
      matchCount: number
      minimumSimilarity: number
    }): Promise<RawVisualMatch[]> {
      const { data, error } = await supabase.rpc('match_product_images_by_visual_embedding', {
        query_embedding: params.queryEmbedding,
        category_ids: params.categoryIds,
        provider: params.provider,
        model: params.model,
        model_version: params.modelVersion,
        match_count: params.matchCount,
        minimum_similarity: params.minimumSimilarity,
      })
      if (error) throw new Error('database_error')
      return ((data ?? []) as Array<{ product_id: string; product_image_id: string; similarity: number }>).map(
        (row) => ({ productId: row.product_id, productImageId: row.product_image_id, similarity: row.similarity }),
      )
    },

    async countIndexedVisualImagesInScope(
      categoryIds: string[] | null,
      provider: string,
      model: string,
      modelVersion: string,
    ): Promise<number> {
      let query = supabase
        .from('product_image_visual_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('provider', provider)
        .eq('model', model)
        .eq('model_version', modelVersion)

      if (categoryIds !== null) {
        const { data: scoped, error: scopedError } = await supabase
          .from('product_categories')
          .select('product_id')
          .in('category_id', categoryIds)
        if (scopedError) throw new Error('database_error')
        const productIds = Array.from(new Set((scoped ?? []).map((r: any) => r.product_id)))
        if (productIds.length === 0) return 0
        query = query.in('product_id', productIds)
      }

      const { count, error } = await query
      if (error) throw new Error('database_error')
      return count ?? 0
    },

    async downloadImageBase64(storagePath: string): Promise<{ base64: string; mimeType: string } | null> {
      const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
      if (error || !data) return null
      const bytes = new Uint8Array(await data.arrayBuffer())
      const mimeType = data.type || 'image/jpeg'
      return { base64: bytesToBase64(bytes), mimeType }
    },

    async downloadImageAsDataUrl(storagePath: string): Promise<string | null> {
      const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
      if (error || !data) return null
      const bytes = new Uint8Array(await data.arrayBuffer())
      const mimeType = data.type || 'image/jpeg'
      return bytesToDataUrl(bytes, mimeType)
    },

    async getVisualSearchCache(cacheKey: string): Promise<VisualProductSearchResponseV2 | null> {
      const { data, error } = await supabase
        .from('visual_search_cache')
        .select('response_payload, expires_at')
        .eq('cache_key', cacheKey)
        .maybeSingle()
      if (error || !data) return null
      if (new Date(data.expires_at).getTime() <= Date.now()) return null
      return data.response_payload as VisualProductSearchResponseV2
    },

    async setVisualSearchCache(input: {
      cacheKey: string
      queryImageSha256: string
      categoryId: string | null
      provider: string
      model: string
      modelVersion: string
      preprocessingVersion: string
      rankingVersion: string
      responsePayload: VisualProductSearchResponseV2
      expiresAt: Date
    }): Promise<void> {
      try {
        await supabase.from('visual_search_cache').upsert(
          {
            cache_key: input.cacheKey,
            query_image_sha256: input.queryImageSha256,
            category_id: input.categoryId,
            provider: input.provider,
            model: input.model,
            model_version: input.modelVersion,
            preprocessing_version: input.preprocessingVersion,
            ranking_version: input.rankingVersion,
            response_payload: input.responsePayload,
            expires_at: input.expiresAt.toISOString(),
          },
          { onConflict: 'cache_key' },
        )
      } catch (err) {
        // Caching must never break the search response.
        console.error('[visual-product-search] Failed to write cache entry:', err)
      }
    },

    async logSearchEvent(event: SearchEventInput): Promise<void> {
      try {
        await supabase.from('visual_search_events').insert({
          category_id: event.categoryId,
          included_category_count: event.includedCategoryCount,
          is_global_search: event.isGlobalSearch,
          status: event.status,
          error_code: event.errorCode ?? null,
          candidates_retrieved: event.candidatesRetrieved,
          candidates_reranked: event.candidatesReranked,
          processing_time_ms: event.processingTimeMs,
          vision_model: event.visionModel ?? null,
          embedding_model: event.embeddingModel ?? null,
          ip_hash: event.ipHash,
        })
      } catch (err) {
        // Logging must never break the search response.
        console.error('[visual-product-search] Failed to log search event:', err)
      }
    },

    async countRecentEventsByIpHash(ipHash: string, sinceIso: string): Promise<number> {
      const { count, error } = await supabase
        .from('visual_search_events')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', sinceIso)
      if (error) return 0
      return count ?? 0
    },
  }
}

export function buildPublicImageUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
}
