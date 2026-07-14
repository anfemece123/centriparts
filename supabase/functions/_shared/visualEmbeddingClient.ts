// Minimal, dependency-free HTTP client for services/visual-search-inference
// (mirrors openaiClient.ts's approach of calling the provider directly via
// `fetch` rather than pulling in an SDK). The service URL/API key are
// server-side secrets — never reach the browser.

export class VisualInferenceRequestError extends Error {
  status: number | null
  constructor(message: string, status: number | null) {
    super(message)
    this.status = status
  }
}

export interface VisualInferenceClientOptions {
  baseUrl: string
  apiKey: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxRetries?: number
}

function isRetryable(err: unknown): boolean {
  return (
    err instanceof VisualInferenceRequestError && (err.status === 429 || (err.status !== null && err.status >= 500))
  )
}

async function withRetries<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryable(err) || attempt >= maxRetries) throw err
      const backoffMs = 300 * 2 ** attempt
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      attempt += 1
    }
  }
}

export interface EmbedImageResult {
  embedding: number[]
  provider: string
  model: string
  modelVersion: string
  dimensions: number
  preprocessingVersion: string
  sourceWidth: number
  sourceHeight: number
  processedWidth: number
  processedHeight: number
}

export interface RerankCandidateInput {
  candidateId: string
  imageBase64: string
  mimeType: string
}

export interface RerankResult {
  candidateId: string
  localSimilarity: number | null
}

export interface ReadReferenceResult {
  rawTokens: string[]
  normalizedTokens: string[]
}

export interface VisualInferenceClient {
  embedImage(params: { imageBase64: string; mimeType: string }): Promise<EmbedImageResult>
  rerankImages(params: {
    queryImageBase64: string
    queryMimeType: string
    candidates: RerankCandidateInput[]
  }): Promise<{ results: RerankResult[]; localRerankAvailable: boolean }>
  readReference(params: { imageBase64: string; mimeType: string }): Promise<ReadReferenceResult>
}

// deno-lint-ignore no-explicit-any
type JsonRecord = Record<string, any>

export function createVisualInferenceClient(options: VisualInferenceClientOptions): VisualInferenceClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  const maxRetries = options.maxRetries ?? 1
  const baseUrl = options.baseUrl.replace(/\/+$/, '')

  function post(path: string, body: unknown): Promise<JsonRecord> {
    return withRetries(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetchImpl(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'X-Internal-Api-Key': options.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!res.ok) {
          // Never echo the response body verbatim — never log/propagate
          // request payload fragments (which could include base64 images).
          throw new VisualInferenceRequestError(`El servicio visual respondió con estado ${res.status}`, res.status)
        }
        return (await res.json()) as JsonRecord
      } finally {
        clearTimeout(timeoutId)
      }
    }, maxRetries)
  }

  return {
    async embedImage(params) {
      const data = await post('/v1/embed-image', { image_base64: params.imageBase64, mime_type: params.mimeType })
      return {
        embedding: data.embedding,
        provider: data.provider,
        model: data.model,
        modelVersion: data.model_version,
        dimensions: data.dimensions,
        preprocessingVersion: data.preprocessing_version,
        sourceWidth: data.source_width,
        sourceHeight: data.source_height,
        processedWidth: data.processed_width,
        processedHeight: data.processed_height,
      }
    },

    async rerankImages(params) {
      const data = await post('/v1/rerank-images', {
        query_image_base64: params.queryImageBase64,
        query_mime_type: params.queryMimeType,
        candidates: params.candidates.map((c) => ({
          candidate_id: c.candidateId,
          image_base64: c.imageBase64,
          mime_type: c.mimeType,
        })),
      })
      return {
        results: (data.results as JsonRecord[]).map((r) => ({
          candidateId: r.candidate_id,
          localSimilarity: r.local_similarity,
        })),
        localRerankAvailable: data.local_rerank_available,
      }
    },

    async readReference(params) {
      const data = await post('/v1/read-reference', { image_base64: params.imageBase64, mime_type: params.mimeType })
      return { rawTokens: data.raw_tokens, normalizedTokens: data.normalized_tokens }
    },
  }
}
