// Minimal, dependency-free OpenAI client built on `fetch` (mirrors the
// existing send-email function's approach of calling the provider's HTTP
// API directly instead of pulling in an SDK). Used only from Edge
// Functions — the API key never reaches the browser.

export class OpenAIRequestError extends Error {
  status: number | null
  constructor(message: string, status: number | null) {
    super(message)
    this.status = status
  }
}

export interface OpenAIClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxRetries?: number
}

function isRetryable(err: unknown): boolean {
  return err instanceof OpenAIRequestError && (err.status === 429 || (err.status !== null && err.status >= 500))
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

interface ResponsesContentPart {
  type: 'output_text'
  text: string
}
interface ResponsesOutputItem {
  type: string
  content?: ResponsesContentPart[]
}
interface ResponsesPayload {
  output_text?: string
  output?: ResponsesOutputItem[]
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

function extractOutputText(data: ResponsesPayload): string {
  if (typeof data.output_text === 'string' && data.output_text.length > 0) return data.output_text

  const message = data.output?.find((item) => item.type === 'message')
  const textPart = message?.content?.find((part) => part.type === 'output_text')
  if (textPart?.text) return textPart.text

  throw new OpenAIRequestError('La respuesta de OpenAI no incluyó contenido de texto.', null)
}

export interface AnalyzeImageParams {
  model: string
  instructions: string
  imageDataUrl: string
  schemaName: string
  schema: Record<string, unknown>
  detail?: 'low' | 'high' | 'auto'
}

export interface RerankParams {
  model: string
  instructions: string
  queryImageDataUrl: string
  candidateImages: Array<{ label: string; imageDataUrl: string }>
  schemaName: string
  schema: Record<string, unknown>
}

export interface CreateEmbeddingParams {
  model: string
  input: string
  dimensions: number
}

export interface OpenAIClient {
  analyzeImage(params: AnalyzeImageParams): Promise<{ json: unknown; usage: ResponsesPayload['usage'] }>
  rerank(params: RerankParams): Promise<{ json: unknown; usage: ResponsesPayload['usage'] }>
  createEmbedding(params: CreateEmbeddingParams): Promise<number[]>
}

export function createOpenAIClient(options: OpenAIClientOptions): OpenAIClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  const maxRetries = options.maxRetries ?? 2

  async function post(path: string, body: unknown): Promise<ResponsesPayload & { data?: Array<{ embedding: number[] }> }> {
    return withRetries(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetchImpl(`https://api.openai.com/v1${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!res.ok) {
          // Never echo the response body verbatim into logs/errors — it can
          // include request fragments. Keep only status + a short reason.
          const status = res.status
          throw new OpenAIRequestError(`OpenAI respondió con estado ${status}`, status)
        }
        return (await res.json()) as ResponsesPayload & { data?: Array<{ embedding: number[] }> }
      } finally {
        clearTimeout(timeoutId)
      }
    }, maxRetries)
  }

  return {
    async analyzeImage(params) {
      const data = await post('/responses', {
        model: params.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: params.instructions }] },
          {
            role: 'user',
            content: [
              { type: 'input_image', image_url: params.imageDataUrl, detail: params.detail ?? 'high' },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            schema: params.schema,
            strict: true,
          },
        },
      })
      return { json: JSON.parse(extractOutputText(data)), usage: data.usage }
    },

    async rerank(params) {
      const content: Array<Record<string, unknown>> = [
        { type: 'input_text', text: params.instructions },
        { type: 'input_text', text: 'Imagen consultada:' },
        { type: 'input_image', image_url: params.queryImageDataUrl, detail: 'high' },
      ]
      for (const candidate of params.candidateImages) {
        content.push({ type: 'input_text', text: candidate.label })
        content.push({ type: 'input_image', image_url: candidate.imageDataUrl, detail: 'low' })
      }

      const data = await post('/responses', {
        model: params.model,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            schema: params.schema,
            strict: true,
          },
        },
      })
      return { json: JSON.parse(extractOutputText(data)), usage: data.usage }
    },

    async createEmbedding(params) {
      const data = await post('/embeddings', {
        model: params.model,
        input: params.input,
        dimensions: params.dimensions,
      })
      const embedding = data.data?.[0]?.embedding
      if (!embedding) throw new OpenAIRequestError('OpenAI no devolvió un embedding.', null)
      return embedding
    },
  }
}
