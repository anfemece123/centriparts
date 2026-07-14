// deno-lint-ignore-file no-explicit-any
// Deno-only: real IndexImagePort implementation backed by Supabase
// (Postgres + Storage) via the service-role client. Kept separate from
// _shared/indexImage.ts so that file stays runtime-agnostic and testable.
import type {
  ExistingFeatureRow,
  IndexImagePort,
  ProductForIndexing,
  ProductImageRow,
  UpsertFeatureInput,
} from './indexImage.ts'

const BUCKET = 'product-images'

export function createSupabaseIndexPort(supabase: any): IndexImagePort {
  return {
    async getProductImage(productImageId) {
      const { data, error } = await supabase
        .from('product_images')
        .select('id, product_id, storage_path')
        .eq('id', productImageId)
        .maybeSingle()
      if (error) throw new Error('database_error')
      return (data as ProductImageRow | null) ?? null
    },

    async getProductForIndexing(productId) {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          id, ci, base_name, display_name, reference,
          brand:brand_id ( name ),
          type:type_id ( name ),
          categories:product_categories ( category:category_id ( name ) ),
          compatibility:product_compatibility (
            year_from, year_to,
            vehicle_brand:vehicle_brand_id ( name ),
            vehicle_model:vehicle_model_id ( name )
          )
          `,
        )
        .eq('id', productId)
        .maybeSingle()

      if (error) throw new Error('database_error')
      if (!data) return null

      const categoryPaths = (data.categories ?? [])
        .map((c: any) => c.category?.name)
        .filter((name: unknown): name is string => Boolean(name))

      const compatibilitySummary = (data.compatibility ?? [])
        .map((c: any) => {
          const vehicle = [c.vehicle_brand?.name, c.vehicle_model?.name].filter(Boolean).join(' ')
          const years = [c.year_from, c.year_to].filter((y: unknown) => y !== null).join('-')
          return [vehicle, years].filter(Boolean).join(' ')
        })
        .filter((s: string) => s.length > 0)

      const result: ProductForIndexing = {
        id: data.id,
        ci: data.ci,
        base_name: data.base_name,
        display_name: data.display_name,
        reference: data.reference,
        brandName: data.brand?.name ?? null,
        typeName: data.type?.name ?? null,
        categoryPaths,
        compatibilitySummary,
      }
      return result
    },

    async downloadImageBytes(storagePath) {
      const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
      if (error || !data) return null
      const bytes = new Uint8Array(await data.arrayBuffer())
      const mimeType = data.type || guessMimeFromPath(storagePath)
      return { bytes, mimeType }
    },

    async getExistingFeature(productImageId, analysisVersion) {
      const { data, error } = await supabase
        .from('product_image_ai_features')
        .select('status, image_sha256, updated_at')
        .eq('product_image_id', productImageId)
        .eq('analysis_version', analysisVersion)
        .maybeSingle()
      if (error) return null
      return (data as ExistingFeatureRow | null) ?? null
    },

    async upsertFeature(input: UpsertFeatureInput) {
      const payload: Record<string, unknown> = {
        product_id: input.productId,
        product_image_id: input.productImageId,
        image_sha256: input.imageSha256,
        analysis_version: input.analysisVersion,
        status: input.status,
      }
      if (input.visionModel !== undefined) payload.vision_model = input.visionModel
      if (input.embeddingModel !== undefined) payload.embedding_model = input.embeddingModel
      if (input.embeddingDimensions !== undefined) payload.embedding_dimensions = input.embeddingDimensions
      if (input.analysis !== undefined) payload.analysis = input.analysis
      if (input.detectedReferenceCodes !== undefined) payload.detected_reference_codes = input.detectedReferenceCodes
      if (input.detectedOemCodes !== undefined) payload.detected_oem_codes = input.detectedOemCodes
      if (input.detectedText !== undefined) payload.detected_text = input.detectedText
      if (input.searchDocument !== undefined) payload.search_document = input.searchDocument
      if (input.embedding !== undefined) payload.embedding = input.embedding
      if (input.analysisConfidence !== undefined) payload.analysis_confidence = input.analysisConfidence
      if (input.errorMessage !== undefined) payload.error_message = input.errorMessage
      if (input.status === 'completed') payload.analyzed_at = new Date().toISOString()

      if (input.attemptIncrement) {
        const { data: current } = await supabase
          .from('product_image_ai_features')
          .select('attempt_count')
          .eq('product_image_id', input.productImageId)
          .eq('analysis_version', input.analysisVersion)
          .maybeSingle()
        payload.attempt_count = (current?.attempt_count ?? 0) + 1
      }

      const { error } = await supabase
        .from('product_image_ai_features')
        .upsert(payload, { onConflict: 'product_image_id,analysis_version' })
      if (error) throw new Error('database_error')
    },
  }
}

function guessMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'heic': return 'image/heic'
    case 'heif': return 'image/heif'
    default: return 'image/jpeg'
  }
}
