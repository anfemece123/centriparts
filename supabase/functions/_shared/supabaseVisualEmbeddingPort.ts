// deno-lint-ignore-file no-explicit-any
// Deno-only: real VisualEmbeddingJobPort implementation backed by Supabase
// (Postgres + Storage) and the visual-search-inference HTTP client. Kept
// separate from _shared/visualEmbeddingJobProcessor.ts so that file stays
// runtime-agnostic and testable, mirroring the existing
// supabaseIndexPort.ts / indexImage.ts split.
import type { EmbedImageOutcome, VisualEmbeddingJobPort } from './visualEmbeddingJobProcessor.ts'
import type { VisualInferenceClient } from './visualEmbeddingClient.ts'

const BUCKET = 'product-images'

export function createSupabaseVisualEmbeddingPort(
  supabase: any,
  inferenceClient: VisualInferenceClient,
): VisualEmbeddingJobPort {
  return {
    async getProductImageStoragePath(productImageId) {
      const { data, error } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('id', productImageId)
        .maybeSingle()
      if (error || !data) return null
      return data.storage_path as string
    },

    async downloadImageBytes(storagePath) {
      const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
      if (error || !data) return null
      const bytes = new Uint8Array(await data.arrayBuffer())
      const mimeType = data.type || guessMimeFromPath(storagePath)
      return { bytes, mimeType }
    },

    async embedImage({ imageBase64, mimeType }): Promise<EmbedImageOutcome> {
      const result = await inferenceClient.embedImage({ imageBase64, mimeType })
      return {
        embedding: result.embedding,
        dimensions: result.dimensions,
        sourceWidth: result.sourceWidth,
        sourceHeight: result.sourceHeight,
        processedWidth: result.processedWidth,
        processedHeight: result.processedHeight,
      }
    },

    async markCompleted(jobId, result) {
      const { error } = await supabase
        .from('product_image_visual_embeddings')
        .update({
          status: 'completed',
          image_sha256: result.imageSha256,
          visual_embedding: result.embedding,
          source_width: result.sourceWidth,
          source_height: result.sourceHeight,
          processed_width: result.processedWidth,
          processed_height: result.processedHeight,
          processing_finished_at: new Date().toISOString(),
          last_error_code: null,
          last_error_message: null,
        })
        .eq('id', jobId)
      if (error) throw new Error('database_error')
    },

    async markFailed(jobId, errorCode, errorMessage) {
      const { error } = await supabase
        .from('product_image_visual_embeddings')
        .update({
          status: 'failed',
          last_error_code: errorCode,
          last_error_message: errorMessage.slice(0, 500),
          processing_finished_at: new Date().toISOString(),
        })
        .eq('id', jobId)
      if (error) throw new Error('database_error')
    },
  }
}

function guessMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    case 'heif':
      return 'image/heif'
    default:
      return 'image/jpeg'
  }
}
