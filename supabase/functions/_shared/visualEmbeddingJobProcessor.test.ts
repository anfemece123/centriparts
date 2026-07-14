import { describe, expect, it, vi } from 'vitest'
import {
  processVisualEmbeddingJob,
  type ClaimedVisualEmbeddingJob,
  type EmbedImageOutcome,
  type VisualEmbeddingJobPort,
} from './visualEmbeddingJobProcessor.ts'

const job: ClaimedVisualEmbeddingJob = {
  id: 'job-1',
  productId: 'prod-1',
  productImageId: 'img-1',
  provider: 'dinov2',
  model: 'facebook/dinov2-small',
  modelVersion: 'v1',
  dimensions: 4,
  preprocessingVersion: 'v1',
}

const embedOutcome: EmbedImageOutcome = {
  embedding: [0.1, 0.2, 0.3, 0.4],
  dimensions: 4,
  sourceWidth: 800,
  sourceHeight: 600,
  processedWidth: 224,
  processedHeight: 224,
}

function makePort(overrides: Partial<VisualEmbeddingJobPort> = {}): VisualEmbeddingJobPort {
  return {
    getProductImageStoragePath: async () => 'prod-1/img-1.jpg',
    downloadImageBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    embedImage: async () => embedOutcome,
    markCompleted: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('processVisualEmbeddingJob', () => {
  it('downloads, embeds, and marks the job completed on success', async () => {
    const port = makePort()
    const result = await processVisualEmbeddingJob(port, job)
    expect(result).toEqual({ jobId: 'job-1', status: 'completed' })
    expect(port.markCompleted).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ embedding: embedOutcome.embedding, imageSha256: expect.any(String) }),
    )
    expect(port.markFailed).not.toHaveBeenCalled()
  })

  it('fails with not_found when the product image row is gone', async () => {
    const port = makePort({ getProductImageStoragePath: async () => null })
    const result = await processVisualEmbeddingJob(port, job)
    expect(result).toEqual({ jobId: 'job-1', status: 'failed', errorCode: 'not_found' })
    expect(port.markFailed).toHaveBeenCalledWith('job-1', 'not_found', expect.any(String))
  })

  it('fails with storage_error when the download fails', async () => {
    const port = makePort({ downloadImageBytes: async () => null })
    const result = await processVisualEmbeddingJob(port, job)
    expect(result).toEqual({ jobId: 'job-1', status: 'failed', errorCode: 'storage_error' })
  })

  it('fails with inference_error when the embedding service throws, without crashing the batch', async () => {
    const port = makePort({
      embedImage: async () => {
        throw new Error('service unavailable')
      },
    })
    const result = await processVisualEmbeddingJob(port, job)
    expect(result).toEqual({ jobId: 'job-1', status: 'failed', errorCode: 'inference_error' })
  })

  it('fails with dimension_mismatch instead of silently storing a wrong-size vector', async () => {
    const port = makePort({ embedImage: async () => ({ ...embedOutcome, dimensions: 999 }) })
    const result = await processVisualEmbeddingJob(port, job)
    expect(result).toEqual({ jobId: 'job-1', status: 'failed', errorCode: 'dimension_mismatch' })
    expect(port.markCompleted).not.toHaveBeenCalled()
  })

  it('sends the image as base64, never as a data URL or raw bytes, to the embedding port', async () => {
    const embedImage = vi.fn(async () => embedOutcome)
    const port = makePort({ embedImage })
    await processVisualEmbeddingJob(port, job)
    const [args] = embedImage.mock.calls[0]
    expect(args.imageBase64).not.toMatch(/^data:/)
    expect(typeof args.imageBase64).toBe('string')
  })
})
