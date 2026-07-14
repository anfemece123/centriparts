// Centralized, typed environment configuration for the visual search feature.
// All values are configurable via env vars with safe defaults, per spec.

type EnvGetter = (name: string) => string | undefined

// Works in both Deno (Edge Functions) and Node (Vitest) without importing
// runtime-specific globals at module scope.
function defaultEnvGetter(): EnvGetter {
  const g = globalThis as unknown as {
    Deno?: { env: { get(name: string): string | undefined } }
    process?: { env: Record<string, string | undefined> }
  }
  if (g.Deno) return (name: string) => g.Deno!.env.get(name)
  if (g.process) return (name: string) => g.process!.env[name]
  return () => undefined
}

function num(getEnv: EnvGetter, name: string, fallback: number): number {
  const raw = getEnv(name)
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function str(getEnv: EnvGetter, name: string, fallback: string): string {
  const raw = getEnv(name)
  return raw === undefined || raw === '' ? fallback : raw
}

function bool(getEnv: EnvGetter, name: string, fallback: boolean): boolean {
  const raw = getEnv(name)
  if (raw === undefined || raw === '') return fallback
  return raw.toLowerCase() === 'true'
}

/** Bumping this forces every image to be re-analyzed and re-embedded. */
export const ANALYSIS_VERSION = 1

export interface VisualSearchConfig {
  openaiApiKey: string | undefined
  visionModel: string
  rerankModel: string
  embeddingModel: string
  embeddingDimensions: number

  globalTopK: number
  categoryTopK: number
  globalRerankK: number
  categoryRerankK: number

  exactThreshold: number
  likelyThreshold: number
  similarThreshold: number
  closeResultMargin: number

  maxFileMb: number

  /** Diagnostic logging (spec: safe stage/timing/count fields only, never
   * secrets, images, embeddings or signed URLs). Off by default. */
  debug: boolean
}

export function loadConfig(getEnv: EnvGetter = defaultEnvGetter()): VisualSearchConfig {
  return {
    openaiApiKey: getEnv('OPENAI_API_KEY'),
    visionModel: str(getEnv, 'OPENAI_VISION_MODEL', 'gpt-4.1-mini'),
    rerankModel: str(getEnv, 'OPENAI_RERANK_MODEL', 'gpt-4.1-mini'),
    embeddingModel: str(getEnv, 'OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large'),
    embeddingDimensions: num(getEnv, 'OPENAI_EMBEDDING_DIMENSIONS', 1536),

    globalTopK: num(getEnv, 'VISUAL_SEARCH_GLOBAL_TOP_K', 25),
    categoryTopK: num(getEnv, 'VISUAL_SEARCH_CATEGORY_TOP_K', 15),
    globalRerankK: num(getEnv, 'VISUAL_SEARCH_GLOBAL_RERANK_K', 8),
    categoryRerankK: num(getEnv, 'VISUAL_SEARCH_CATEGORY_RERANK_K', 6),

    exactThreshold: num(getEnv, 'VISUAL_SEARCH_EXACT_THRESHOLD', 0.92),
    likelyThreshold: num(getEnv, 'VISUAL_SEARCH_LIKELY_THRESHOLD', 0.80),
    similarThreshold: num(getEnv, 'VISUAL_SEARCH_SIMILAR_THRESHOLD', 0.62),
    closeResultMargin: num(getEnv, 'VISUAL_SEARCH_CLOSE_RESULT_MARGIN', 0.04),

    maxFileMb: num(getEnv, 'VISUAL_SEARCH_MAX_FILE_MB', 8),

    debug: bool(getEnv, 'VISUAL_SEARCH_DEBUG', false),
  }
}

// ============================================================
// NEW pixel-embedding visual search pipeline config
// ============================================================
// Kept separate from VisualSearchConfig above (the legacy OpenAI
// text-embedding pipeline's config) so each pipeline's env vars are
// unambiguous about which engine they belong to — VISUAL_SEARCH_ENGINE
// decides which pipeline(s) actually run.

export interface VisualEngineConfig {
  engineMode: 'legacy' | 'hybrid' | 'visual'

  inferenceServiceUrl: string | undefined
  inferenceServiceApiKey: string | undefined

  embeddingProvider: string
  embeddingModel: string
  embeddingVersion: string
  embeddingDimensions: number
  preprocessingVersion: string

  categoryRetrievalK: number
  globalRetrievalK: number
  minRawSimilarity: number

  localRerankEnabled: boolean
  localRerankCandidates: number

  ocrEnabled: boolean

  openAiEnabled: boolean
  openAiRerankEnabled: boolean
  openAiMaxCandidates: number
  openAiScoreMargin: number

  cacheTtlMinutes: number

  indexBatchSize: number
  indexMaxConcurrency: number
  indexMaxAttempts: number
  indexStaleProcessingMinutes: number
}

export function loadVisualEngineConfig(getEnv: EnvGetter = defaultEnvGetter()): VisualEngineConfig {
  const engineModeRaw = str(getEnv, 'VISUAL_SEARCH_ENGINE', 'hybrid')
  const engineMode: VisualEngineConfig['engineMode'] =
    engineModeRaw === 'legacy' || engineModeRaw === 'visual' ? engineModeRaw : 'hybrid'

  return {
    engineMode,

    inferenceServiceUrl: getEnv('VISUAL_INFERENCE_SERVICE_URL'),
    inferenceServiceApiKey: getEnv('VISUAL_INFERENCE_API_KEY'),

    embeddingProvider: str(getEnv, 'VISUAL_EMBEDDING_PROVIDER', 'dinov2'),
    embeddingModel: str(getEnv, 'VISUAL_EMBEDDING_MODEL', 'facebook/dinov2-small'),
    embeddingVersion: str(getEnv, 'VISUAL_EMBEDDING_VERSION', 'v1'),
    embeddingDimensions: num(getEnv, 'VISUAL_EMBEDDING_DIMENSIONS', 384),
    preprocessingVersion: str(getEnv, 'VISUAL_PREPROCESSING_VERSION', 'v1'),

    categoryRetrievalK: num(getEnv, 'VISUAL_SEARCH_CATEGORY_RETRIEVAL_K', 60),
    globalRetrievalK: num(getEnv, 'VISUAL_SEARCH_GLOBAL_RETRIEVAL_K', 100),
    minRawSimilarity: num(getEnv, 'VISUAL_SEARCH_MIN_RAW_SIMILARITY', 0.15),

    localRerankEnabled: bool(getEnv, 'VISUAL_LOCAL_RERANK_ENABLED', true),
    localRerankCandidates: num(getEnv, 'VISUAL_LOCAL_RERANK_CANDIDATES', 15),

    ocrEnabled: bool(getEnv, 'VISUAL_OCR_ENABLED', true),

    openAiEnabled: bool(getEnv, 'VISUAL_SEARCH_OPENAI_ENABLED', false),
    openAiRerankEnabled: bool(getEnv, 'VISUAL_SEARCH_OPENAI_RERANK_ENABLED', false),
    openAiMaxCandidates: num(getEnv, 'VISUAL_SEARCH_OPENAI_MAX_CANDIDATES', 5),
    openAiScoreMargin: num(getEnv, 'VISUAL_SEARCH_OPENAI_SCORE_MARGIN', 0.04),

    cacheTtlMinutes: num(getEnv, 'VISUAL_SEARCH_CACHE_TTL_MINUTES', 60),

    indexBatchSize: num(getEnv, 'VISUAL_INDEX_BATCH_SIZE', 10),
    indexMaxConcurrency: num(getEnv, 'VISUAL_INDEX_MAX_CONCURRENCY', 2),
    indexMaxAttempts: num(getEnv, 'VISUAL_INDEX_MAX_ATTEMPTS', 4),
    indexStaleProcessingMinutes: num(getEnv, 'VISUAL_INDEX_STALE_PROCESSING_MINUTES', 5),
  }
}
