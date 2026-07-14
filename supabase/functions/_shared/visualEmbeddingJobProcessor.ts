// Pure, testable core of the visual-embedding-worker Edge Function (spec
// sections 10/11/12): given one already-claimed job row, download its
// image, embed it via the Python inference service, and persist the
// result. Claiming (atomic, SKIP LOCKED, stuck-job recovery) happens in SQL
// (claim_visual_embedding_jobs, see the migration) — this file only handles
// what happens to a job once it's been claimed.

import { sha256Hex } from './hash.ts'
import { bytesToBase64 } from './imageProcessing.ts'

export interface ClaimedVisualEmbeddingJob {
  id: string
  productId: string
  productImageId: string
  provider: string
  model: string
  modelVersion: string
  dimensions: number
  preprocessingVersion: string
}

export interface EmbedImageOutcome {
  embedding: number[]
  dimensions: number
  sourceWidth: number
  sourceHeight: number
  processedWidth: number
  processedHeight: number
}

export interface VisualEmbeddingJobPort {
  getProductImageStoragePath(productImageId: string): Promise<string | null>
  downloadImageBytes(storagePath: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>
  embedImage(params: { imageBase64: string; mimeType: string }): Promise<EmbedImageOutcome>
  markCompleted(
    jobId: string,
    result: { imageSha256: string } & EmbedImageOutcome,
  ): Promise<void>
  markFailed(jobId: string, errorCode: string, errorMessage: string): Promise<void>
}

export type VisualEmbeddingJobResult =
  | { jobId: string; status: 'completed' }
  | { jobId: string; status: 'failed'; errorCode: string }

/** Idempotency for "no reprocesar sin cambios" (spec section 10) is
 * enforced upstream, at enqueue time (the auto-enqueue trigger and
 * enqueue_missing_visual_embedding_jobs both skip images that already have
 * a completed row for the exact same provider/model/version/preprocessing
 * combination) — a job only ever reaches "claimed" here because it is
 * genuinely new, its image changed, or it is a legitimate retry. So this
 * function always (re)computes the embedding; it does not need its own
 * separate hash-based skip check.
 */
export async function processVisualEmbeddingJob(
  port: VisualEmbeddingJobPort,
  job: ClaimedVisualEmbeddingJob,
): Promise<VisualEmbeddingJobResult> {
  const storagePath = await port.getProductImageStoragePath(job.productImageId)
  if (!storagePath) {
    await port.markFailed(job.id, 'not_found', 'La imagen del producto ya no existe.')
    return { jobId: job.id, status: 'failed', errorCode: 'not_found' }
  }

  const downloaded = await port.downloadImageBytes(storagePath)
  if (!downloaded) {
    await port.markFailed(job.id, 'storage_error', 'No se pudo descargar la imagen desde Storage.')
    return { jobId: job.id, status: 'failed', errorCode: 'storage_error' }
  }

  const imageSha256 = await sha256Hex(downloaded.bytes)

  try {
    const outcome = await port.embedImage({
      imageBase64: bytesToBase64(downloaded.bytes),
      mimeType: downloaded.mimeType,
    })

    if (outcome.dimensions !== job.dimensions) {
      const message = `El servicio devolvió un vector de ${outcome.dimensions} dimensiones, se esperaban ${job.dimensions}.`
      await port.markFailed(job.id, 'dimension_mismatch', message)
      return { jobId: job.id, status: 'failed', errorCode: 'dimension_mismatch' }
    }

    await port.markCompleted(job.id, { imageSha256, ...outcome })
    return { jobId: job.id, status: 'completed' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al generar el embedding visual.'
    await port.markFailed(job.id, 'inference_error', message.slice(0, 500))
    return { jobId: job.id, status: 'failed', errorCode: 'inference_error' }
  }
}
