import { sha256Hex } from './hash.ts'
import { bytesToDataUrl, sanitizeImageBytes } from './imageProcessing.ts'
import { analyzeAutomotivePartImage } from './imageAnalysis.ts'
import { generateTextEmbedding } from './embedding.ts'
import { buildImageSearchDocument } from './buildImageSearchDocument.ts'
import { ANALYSIS_VERSION, type VisualSearchConfig } from './config.ts'
import type { OpenAIClient } from './openaiClient.ts'

export interface ProductImageRow {
  id: string
  product_id: string
  storage_path: string
}

export interface ProductForIndexing {
  id: string
  ci: string
  base_name: string
  display_name: string | null
  reference: string | null
  brandName: string | null
  typeName: string | null
  categoryPaths: string[]
  compatibilitySummary: string[]
}

export interface ExistingFeatureRow {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_sha256: string
  updated_at: string
}

export interface UpsertFeatureInput {
  productId: string
  productImageId: string
  imageSha256: string
  analysisVersion: number
  status: 'processing' | 'completed' | 'failed'
  visionModel?: string
  embeddingModel?: string
  embeddingDimensions?: number
  analysis?: unknown
  detectedReferenceCodes?: string[]
  detectedOemCodes?: string[]
  detectedText?: string[]
  searchDocument?: string
  embedding?: number[]
  analysisConfidence?: number | null
  errorMessage?: string | null
  attemptIncrement?: boolean
}

export interface IndexImagePort {
  getProductImage(productImageId: string): Promise<ProductImageRow | null>
  getProductForIndexing(productId: string): Promise<ProductForIndexing | null>
  downloadImageBytes(storagePath: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>
  getExistingFeature(productImageId: string, analysisVersion: number): Promise<ExistingFeatureRow | null>
  upsertFeature(input: UpsertFeatureInput): Promise<void>
}

export type IndexImageOutcome =
  | { productImageId: string; status: 'completed' }
  | { productImageId: string; status: 'skipped'; reason: string }
  | { productImageId: string; status: 'failed'; reason: string }

// If a row has been sitting in "processing" for less than this, another
// invocation is almost certainly already working on it — skip instead of
// racing it (double OpenAI calls, clobbered attempt_count). Past this
// window we assume that invocation crashed/timed out and it's safe to
// reclaim the row, so a stuck row can never block indexing forever.
const PROCESSING_STALE_MS = 2 * 60 * 1000

/**
 * Indexes a single product image (Etapa A): downloads it, analyzes it with
 * OpenAI, builds the search document, generates its embedding, and
 * persists everything. Idempotent by (image hash, analysis version) — a
 * completed row for the same hash/version is skipped without calling
 * OpenAI again.
 */
export async function indexProductImage(
  port: IndexImagePort,
  openaiClient: OpenAIClient,
  config: VisualSearchConfig,
  productImageId: string,
): Promise<IndexImageOutcome> {
  const image = await port.getProductImage(productImageId)
  if (!image) {
    return { productImageId, status: 'failed', reason: 'not_found' }
  }

  const downloaded = await port.downloadImageBytes(image.storage_path)
  if (!downloaded) {
    return { productImageId, status: 'failed', reason: 'storage_error' }
  }

  const imageSha256 = await sha256Hex(downloaded.bytes)

  const existing = await port.getExistingFeature(productImageId, ANALYSIS_VERSION)
  if (existing && existing.status === 'completed' && existing.image_sha256 === imageSha256) {
    return { productImageId, status: 'skipped', reason: 'already_indexed' }
  }
  if (existing && existing.status === 'processing') {
    const ageMs = Date.now() - new Date(existing.updated_at).getTime()
    if (ageMs < PROCESSING_STALE_MS) {
      return { productImageId, status: 'skipped', reason: 'already_processing' }
    }
    // Older than the staleness window — the run that claimed it likely
    // crashed or timed out. Fall through and reclaim it below.
  }

  const product = await port.getProductForIndexing(image.product_id)
  if (!product) {
    return { productImageId, status: 'failed', reason: 'product_not_found' }
  }

  await port.upsertFeature({
    productId: image.product_id,
    productImageId,
    imageSha256,
    analysisVersion: ANALYSIS_VERSION,
    status: 'processing',
    attemptIncrement: true,
  })

  try {
    const sanitized = sanitizeImageBytes(downloaded.bytes, downloaded.mimeType)
    const dataUrl = bytesToDataUrl(sanitized, downloaded.mimeType)

    const analysis = await analyzeAutomotivePartImage(openaiClient, {
      imageDataUrl: dataUrl,
      model: config.visionModel,
    })

    const searchDocument = buildImageSearchDocument({
      ci: product.ci,
      productName: product.display_name ?? product.base_name,
      brand: product.brandName,
      type: product.typeName,
      categoryPaths: product.categoryPaths,
      reference: product.reference,
      oemCodes: analysis.oemCodes,
      visualDescription: analysis.searchDescription || null,
      detectedText: analysis.printedText,
      materials: analysis.materials,
      generalShape: analysis.generalShape,
      connectorType: analysis.connectorType,
      connectorCount: analysis.connectorCount,
      mountingPoints: analysis.mountingPoints,
      distinctiveFeatures: analysis.distinctiveFeatures,
      compatibilitySummary: product.compatibilitySummary,
    })

    const embedding = await generateTextEmbedding(openaiClient, {
      model: config.embeddingModel,
      dimensions: config.embeddingDimensions,
      text: searchDocument,
    })

    await port.upsertFeature({
      productId: image.product_id,
      productImageId,
      imageSha256,
      analysisVersion: ANALYSIS_VERSION,
      status: 'completed',
      visionModel: config.visionModel,
      embeddingModel: config.embeddingModel,
      embeddingDimensions: config.embeddingDimensions,
      analysis,
      detectedReferenceCodes: analysis.referenceCodes,
      detectedOemCodes: analysis.oemCodes,
      detectedText: analysis.printedText,
      searchDocument,
      embedding,
      analysisConfidence: analysis.isAutomotivePart ? confidenceFromQuality(analysis.imageQuality) : 0,
      errorMessage: null,
    })

    return { productImageId, status: 'completed' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido durante la indexación.'
    await port.upsertFeature({
      productId: image.product_id,
      productImageId,
      imageSha256,
      analysisVersion: ANALYSIS_VERSION,
      status: 'failed',
      errorMessage: message.slice(0, 500),
    })
    return { productImageId, status: 'failed', reason: message }
  }
}

function confidenceFromQuality(quality: 'excellent' | 'good' | 'limited' | 'poor'): number {
  switch (quality) {
    case 'excellent': return 0.95
    case 'good': return 0.85
    case 'limited': return 0.6
    case 'poor': return 0.35
  }
}
