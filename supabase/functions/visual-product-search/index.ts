// Supabase Edge Function — visual-product-search
// Runtime: Deno
//
// Public entrypoint (no login required — this powers the storefront's
// "Buscar repuesto por foto" feature). verify_jwt is disabled for this
// function in supabase/config.toml, the same pattern already used by
// send-email, because the publishable anon key is not a JWT. An optional
// FUNCTION_SECRET header check restricts calls to this project's own
// frontend; a per-IP rate limit backed by visual_search_events guards
// against abuse.
//
// Engine switch (spec section 26): VISUAL_SEARCH_ENGINE=legacy|hybrid|visual
//   - legacy:  only the original OpenAI text-embedding pipeline runs.
//   - hybrid:  the new pixel-embedding pipeline runs when the search scope
//              has visual coverage; falls back to the legacy pipeline
//              otherwise (never a partial mix — one pipeline runs per request).
//   - visual:  only the new pixel-embedding pipeline runs. If the visual
//              inference service is unavailable, this returns an error —
//              it never silently falls back to the legacy system.
//
// Regardless of which pipeline ran, the response is always reshaped into
// the single V2 contract (VisualProductSearchResponseV2, spec section 21)
// so the frontend never needs to know which engine answered.
//
// Costs (spec sections 18/24): the new pipeline makes 0 OpenAI calls by
// default. It can make at most 1 additional OpenAI call, only when
// VISUAL_SEARCH_OPENAI_ENABLED and VISUAL_SEARCH_OPENAI_RERANK_ENABLED are
// both true AND the top two candidates are within VISUAL_SEARCH_OPENAI_SCORE_MARGIN
// of each other — never once a deterministic reference match already
// resolved the search, never once per candidate, never for a cache hit.
//
// Supabase secrets required (`supabase secrets set`):
//   OPENAI_API_KEY              — legacy pipeline + optional ambiguity tie-break.
//   VISUAL_INFERENCE_SERVICE_URL, VISUAL_INFERENCE_API_KEY — new pipeline.
//   FUNCTION_SECRET              — optional, shared with the frontend as
//                                  VITE_FUNCTION_SECRET (same convention as send-email).
//   IP_HASH_PEPPER               — optional extra pepper for the rate-limit IP hash.

import { loadConfig, loadVisualEngineConfig, type VisualEngineConfig } from '../_shared/config.ts'
import { createOpenAIClient, OpenAIRequestError } from '../_shared/openaiClient.ts'
import { createServiceRoleClient } from '../_shared/supabaseClient.ts'
import { createSearchDbPort, buildPublicImageUrl, type ProductDetailRowV2 } from '../_shared/supabaseSearchPort.ts'
import { validateUploadedImage } from '../_shared/imageValidation.ts'
import { sanitizeImageBytes, bytesToDataUrl } from '../_shared/imageProcessing.ts'
import { sha256Hex, sha256HexOfText } from '../_shared/hash.ts'
import { resolveCategoryScope, CategoryScopeError } from '../_shared/categoryScope.ts'
import { analyzeAutomotivePartImage, InvalidAnalysisResponseError } from '../_shared/imageAnalysis.ts'
import { buildQuerySearchText } from '../_shared/buildImageSearchDocument.ts'
import { generateTextEmbedding } from '../_shared/embedding.ts'
import { findExactReferenceMatches } from '../_shared/exactMatch.ts'
import { findVectorCandidates, type VectorCandidate } from '../_shared/vectorSearch.ts'
import { rerankVisualCandidates, InvalidRerankResponseError } from '../_shared/rerank.ts'
import { calculateVisualSearchScore, classifyVisualSearchResult, type CandidateScore } from '../_shared/scoring.ts'
import { isRateLimited } from '../_shared/rateLimit.ts'
import { createVisualInferenceClient, VisualInferenceRequestError } from '../_shared/visualEmbeddingClient.ts'
import { groupVisualMatchesByProduct } from '../_shared/visualGrouping.ts'
import { computeMetadataScore, computeRanking, RANKING_VERSION } from '../_shared/visualRanking.ts'
import { determineResponseStatus } from '../_shared/visualResponseStatus.ts'
import { applyOpenAiVerdicts, selectTiebreakPool, shouldRunOpenAiTiebreak } from '../_shared/visualOpenAiTiebreak.ts'
import { buildVisualSearchCacheKey, computeCacheExpiry } from '../_shared/visualCache.ts'
import { buildLegacyResponseV2, buildLegacyResultV2 } from '../_shared/legacyResultAdapter.ts'
import type { RerankCandidateResult } from '../_shared/types.ts'
import type { VisualProductResultV2, VisualProductSearchResponseV2 } from '../_shared/visualSearchTypes.ts'
import type { VisualSearchErrorCode } from '../_shared/types.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-internal-secret',
  ].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 20
const MAX_RESULTS = 15

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(code: VisualSearchErrorCode, message: string, searchId: string, status: number): Response {
  return json({ error: true, code, message, searchId }, status)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const searchId = crypto.randomUUID()
  const startedAt = Date.now()

  const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')
  if (FUNCTION_SECRET && req.headers.get('x-internal-secret') !== FUNCTION_SECRET) {
    return errorResponse('unexpected_error', 'Solicitud no autorizada.', searchId, 401)
  }

  const legacyConfig = loadConfig()
  const engineConfig = loadVisualEngineConfig()

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (err) {
    console.error(`[visual-product-search:${searchId}] Missing Supabase credentials:`, err)
    return errorResponse('unexpected_error', 'Servicio no disponible.', searchId, 503)
  }
  const dbPort = createSearchDbPort(supabase)

  // ── Rate limiting (best effort) ─────────────────────────────────────────
  const forwardedFor = req.headers.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null
  const ipHash = clientIp
    ? await sha256HexOfText(`${Deno.env.get('IP_HASH_PEPPER') ?? ''}|${new Date().toISOString().slice(0, 10)}|${clientIp}`)
    : null

  try {
    if (
      await isRateLimited(
        { ipHash, windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: RATE_LIMIT_MAX_REQUESTS },
        { countRecentEventsByIpHash: (h, s) => dbPort.countRecentEventsByIpHash(h, s) },
      )
    ) {
      return errorResponse('rate_limited', 'Demasiadas búsquedas en poco tiempo. Intenta de nuevo en unos minutos.', searchId, 429)
    }
  } catch {
    // Rate limit check failing open is safer than blocking all searches.
  }

  // ── Reject oversized uploads before buffering the multipart body ────────
  const contentLength = Number(req.headers.get('content-length') ?? '0')
  const maxUploadBytes = legacyConfig.maxFileMb * 1024 * 1024
  if (contentLength > 0 && contentLength > maxUploadBytes * 1.5) {
    return errorResponse(
      'file_too_large',
      `La imagen supera el tamaño máximo permitido (${legacyConfig.maxFileMb} MB).`,
      searchId,
      413,
    )
  }

  // ── Parse multipart form ────────────────────────────────────────────────
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return errorResponse('invalid_file', 'No se pudo leer la imagen enviada.', searchId, 400)
  }

  const file = form.get('image')
  const rawCategoryId = form.get('categoryId')
  const categoryId = typeof rawCategoryId === 'string' && rawCategoryId.length > 0 ? rawCategoryId : null

  if (!(file instanceof File)) {
    return errorResponse('invalid_file', 'Debes adjuntar una imagen.', searchId, 400)
  }
  if (categoryId !== null && !UUID_RE.test(categoryId)) {
    return errorResponse('invalid_category', 'La categoría seleccionada no es válida.', searchId, 400)
  }

  const imageValidation = validateUploadedImage({ mimeType: file.type, sizeBytes: file.size }, legacyConfig.maxFileMb)
  if (!imageValidation.valid) {
    const status = imageValidation.errorCode === 'file_too_large' ? 413 : 400
    const message =
      imageValidation.errorCode === 'file_too_large'
        ? `La imagen supera el tamaño máximo permitido (${legacyConfig.maxFileMb} MB).`
        : 'El archivo no es una imagen válida.'
    return errorResponse(imageValidation.errorCode!, message, searchId, status)
  }

  // ── Category scope ──────────────────────────────────────────────────────
  let scope: Awaited<ReturnType<typeof resolveCategoryScope>>
  try {
    scope = await resolveCategoryScope(categoryId, {
      getCategory: (id) => dbPort.getCategory(id),
      getDescendantIds: (id) => dbPort.getCategoryDescendantIds(id),
    })
  } catch (err) {
    if (err instanceof CategoryScopeError) {
      const message =
        err.code === 'invalid_category'
          ? 'La categoría seleccionada no existe.'
          : 'La categoría seleccionada no está disponible.'
      return errorResponse(err.code, message, searchId, 400)
    }
    console.error(`[visual-product-search:${searchId}] Scope resolution failed:`, err)
    return errorResponse('database_error', 'No se pudo preparar la búsqueda.', searchId, 500)
  }

  const includedCategoryIds = scope.isGlobalSearch ? null : scope.includedCategoryIds
  let selectedCategoryName: string | null = null
  try {
    if (!scope.isGlobalSearch) {
      const categoryRow = await dbPort.getCategory(scope.selectedCategoryId!)
      selectedCategoryName = categoryRow?.name ?? null
    }
  } catch {
    // Non-fatal — only used for display/prompt context.
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const scopeForResponse = {
    isGlobalSearch: scope.isGlobalSearch,
    selectedCategoryId: scope.selectedCategoryId,
    selectedCategoryName,
  }

  // ── Engine selection (spec section 26) ──────────────────────────────────
  const visualEngineReady = Boolean(engineConfig.inferenceServiceUrl && engineConfig.inferenceServiceApiKey)

  try {
    if (engineConfig.engineMode === 'legacy') {
      return await runLegacyPipeline({
        req, searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds,
        selectedCategoryName, legacyConfig, dbPort, supabase,
      })
    }

    if (engineConfig.engineMode === 'visual') {
      if (!visualEngineReady) {
        console.error(`[visual-product-search:${searchId}] Missing visual inference service credentials`)
        return errorResponse('openai_unavailable', 'La búsqueda visual no está disponible en este momento.', searchId, 503)
      }
      const indexedImagesInScope = await dbPort.countIndexedVisualImagesInScope(
        includedCategoryIds,
        engineConfig.embeddingProvider,
        engineConfig.embeddingModel,
        engineConfig.embeddingVersion,
      )
      return await runVisualPipeline({
        searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds,
        engineConfig, legacyConfig, dbPort, indexedImagesInScope,
      })
    }

    // hybrid
    const indexedImagesInScope = visualEngineReady
      ? await dbPort.countIndexedVisualImagesInScope(
          includedCategoryIds,
          engineConfig.embeddingProvider,
          engineConfig.embeddingModel,
          engineConfig.embeddingVersion,
        )
      : 0

    if (visualEngineReady && indexedImagesInScope > 0) {
      try {
        return await runVisualPipeline({
          searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds,
          engineConfig, legacyConfig, dbPort, indexedImagesInScope,
        })
      } catch (err) {
        // Hybrid mode falls back to the legacy pipeline on a visual-engine
        // failure — 'visual' mode (above) does not do this on purpose.
        console.error(`[visual-product-search:${searchId}] Visual pipeline failed, falling back to legacy:`, err)
      }
    }

    return await runLegacyPipeline({
      req, searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds,
      selectedCategoryName, legacyConfig, dbPort, supabase,
    })
  } catch (err) {
    return handleTopLevelError(err, searchId)
  }
})

function handleTopLevelError(err: unknown, searchId: string): Response {
  console.error(`[visual-product-search:${searchId}] Pipeline error:`, err instanceof Error ? err.message : err)

  let code: VisualSearchErrorCode = 'unexpected_error'
  let status = 500
  let message = 'No se pudo completar la búsqueda. Intenta de nuevo.'

  if (err instanceof OpenAIRequestError) {
    if (err.status === 429) {
      code = 'rate_limited'
      status = 429
      message = 'El servicio de análisis está saturado. Intenta de nuevo en unos minutos.'
    } else {
      code = 'openai_unavailable'
      status = 503
      message = 'El servicio de análisis visual no está disponible en este momento.'
    }
  } else if (err instanceof VisualInferenceRequestError) {
    code = 'openai_unavailable'
    status = 503
    message = 'El servicio de búsqueda visual no está disponible en este momento.'
  } else if (err instanceof InvalidAnalysisResponseError || err instanceof InvalidRerankResponseError) {
    code = 'unexpected_error'
    status = 502
    message = 'No se pudo interpretar el análisis visual. Intenta de nuevo.'
  } else if (err instanceof Error && err.message === 'database_error') {
    code = 'database_error'
    status = 500
    message = 'No se pudo completar la búsqueda por un problema interno.'
  }

  return errorResponse(code, message, searchId, status)
}

// ============================================================
// NEW pipeline: pixel embeddings (image against image)
// ============================================================

async function runVisualPipeline(params: {
  searchId: string
  startedAt: number
  file: File
  bytes: Uint8Array
  scope: Awaited<ReturnType<typeof resolveCategoryScope>>
  scopeForResponse: VisualProductSearchResponseV2['scope']
  includedCategoryIds: string[] | null
  engineConfig: VisualEngineConfig
  legacyConfig: ReturnType<typeof loadConfig>
  dbPort: ReturnType<typeof createSearchDbPort>
  indexedImagesInScope: number
}): Promise<Response> {
  const { searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds, engineConfig, legacyConfig, dbPort, indexedImagesInScope } = params

  if (indexedImagesInScope === 0) {
    return json(buildEmptyResponse(searchId, scopeForResponse, 'not_indexed', startedAt, engineConfig, 0), 200)
  }

  const queryImageSha256 = await sha256Hex(bytes)
  const cacheKey = await buildVisualSearchCacheKey({
    queryImageSha256,
    categoryId: scope.selectedCategoryId,
    provider: engineConfig.embeddingProvider,
    model: engineConfig.embeddingModel,
    modelVersion: engineConfig.embeddingVersion,
    preprocessingVersion: engineConfig.preprocessingVersion,
    rankingVersion: RANKING_VERSION,
  })

  const cached = await dbPort.getVisualSearchCache(cacheKey)
  if (cached) {
    return json(
      { ...cached, searchId, meta: { ...cached.meta, cacheHit: true, processingTimeMs: Date.now() - startedAt } },
      200,
    )
  }

  const inferenceClient = createVisualInferenceClient({
    baseUrl: engineConfig.inferenceServiceUrl!,
    apiKey: engineConfig.inferenceServiceApiKey!,
  })

  const imageBase64 = base64FromBytes(bytes)
  const embedded = await inferenceClient.embedImage({ imageBase64, mimeType: file.type })

  // ── Best-effort local OCR (never blocks the search) ─────────────────────
  let ocrTokens: string[] = []
  let usedLocalOcr = false
  if (engineConfig.ocrEnabled) {
    try {
      const ocrResult = await inferenceClient.readReference({ imageBase64, mimeType: file.type })
      ocrTokens = ocrResult.normalizedTokens
      usedLocalOcr = true
    } catch (err) {
      console.error(`[visual-product-search:${searchId}] OCR failed (non-fatal):`, err instanceof Error ? err.message : err)
    }
  }

  // ── Deterministic exact match takes priority over visual similarity ────
  if (ocrTokens.length > 0) {
    const candidates = await dbPort.fetchExactMatchCandidates(includedCategoryIds)
    const matches = findExactReferenceMatches({ ci: null, referenceCodes: ocrTokens, oemCodes: [] }, candidates, includedCategoryIds)
    const uniqueProductIds = Array.from(new Set(matches.map((m) => m.productId)))
    if (uniqueProductIds.length === 1) {
      const details = await dbPort.fetchProductDetailsV2(uniqueProductIds)
      const detail = details.get(uniqueProductIds[0])
      if (detail) {
        const result = buildResultV2(detail, 1, {
          globalVisualSimilarity: 1,
          localVisualSimilarity: null,
          metadataScore: 1,
          consensusBonus: 0,
          isExactReferenceMatch: true,
        }, detail.primaryImagePath)

        const response = buildVisualResponse({
          searchId, scopeForResponse, results: [result], indexedImagesInScope, rawImagesRetrieved: 0,
          uniqueProductsRetrieved: 1, localRerankCandidates: 0, usedLocalOcr, usedLocalReranking: false,
          usedOpenAi: false, openAiCallCount: 0, startedAt, engineConfig,
        })
        await cacheResponse(dbPort, cacheKey, queryImageSha256, scope.selectedCategoryId, engineConfig, response)
        return json(response, 200)
      }
    }
  }

  // ── Vector retrieval (category filter applied inside the RPC) ──────────
  const matchCount = scope.isGlobalSearch ? engineConfig.globalRetrievalK : engineConfig.categoryRetrievalK
  const rawMatches = await dbPort.matchByVisualEmbedding({
    queryEmbedding: embedded.embedding,
    categoryIds: includedCategoryIds,
    provider: engineConfig.embeddingProvider,
    model: engineConfig.embeddingModel,
    modelVersion: engineConfig.embeddingVersion,
    matchCount,
    minimumSimilarity: engineConfig.minRawSimilarity,
  })

  if (rawMatches.length === 0) {
    const response = buildEmptyResponse(searchId, scopeForResponse, 'no_results', startedAt, engineConfig, indexedImagesInScope)
    return json(response, 200)
  }

  // ── Grouping (one card per product) + consensus bonus ──────────────────
  const grouped = groupVisualMatchesByProduct(rawMatches)
  const productIds = grouped.map((g) => g.productId)
  const details = await dbPort.fetchProductDetailsV2(productIds)

  const imageIds = grouped.map((g) => g.bestProductImageId)
  const storagePaths = await dbPort.fetchImageStoragePaths(imageIds)

  // ── Local (non-OpenAI) visual reranking on a small top pool ─────────────
  const localRerankPool = engineConfig.localRerankEnabled
    ? selectTiebreakPool(grouped, engineConfig.localRerankCandidates)
    : []
  const localSimilarityByProduct = new Map<string, number>()
  let usedLocalReranking = false

  if (localRerankPool.length > 0) {
    try {
      const candidateInputs = await Promise.all(
        localRerankPool.map(async (candidate) => {
          const storagePath = storagePaths.get(candidate.bestProductImageId)
          const downloaded = storagePath ? await dbPort.downloadImageBase64(storagePath) : null
          return downloaded
            ? { candidateId: candidate.productId, imageBase64: downloaded.base64, mimeType: downloaded.mimeType }
            : null
        }),
      )
      const validInputs = candidateInputs.filter((c): c is NonNullable<typeof c> => c !== null)
      if (validInputs.length > 0) {
        const rerankResponse = await inferenceClient.rerankImages({
          queryImageBase64: imageBase64,
          queryMimeType: file.type,
          candidates: validInputs,
        })
        usedLocalReranking = rerankResponse.localRerankAvailable
        for (const r of rerankResponse.results) {
          if (r.localSimilarity !== null) localSimilarityByProduct.set(r.candidateId, r.localSimilarity)
        }
      }
    } catch (err) {
      console.error(`[visual-product-search:${searchId}] Local rerank failed (non-fatal):`, err instanceof Error ? err.message : err)
    }
  }

  // ── Ranking ──────────────────────────────────────────────────────────────
  let scoredCandidates = grouped.map((candidate) => {
    const detail = details.get(candidate.productId)
    const brandDetectedViaOcr = Boolean(
      detail?.brand && ocrTokens.some((t) => detail.brand!.toUpperCase().includes(t) || t.includes(detail.brand!.toUpperCase())),
    )
    const referenceHintDetected = Boolean(
      detail?.reference &&
        ocrTokens.some((t) => t.length >= 3 && (detail.reference!.toUpperCase().includes(t) || t.includes(detail.reference!.toUpperCase()))),
    )
    const metadataScore = computeMetadataScore({ brandDetectedViaOcr, referenceHintDetected })
    const ranking = computeRanking({
      globalVisualSimilarity: candidate.bestSimilarity,
      localVisualSimilarity: localSimilarityByProduct.get(candidate.productId) ?? null,
      metadataScore,
      consensusBonus: candidate.consensusBonus,
      isExactReferenceMatch: false,
    })
    return { productId: candidate.productId, candidate, ranking }
  })

  scoredCandidates.sort((a, b) => b.ranking.finalScore - a.ranking.finalScore)

  // ── Optional, tightly-bounded OpenAI ambiguity tie-break ────────────────
  let usedOpenAi = false
  let openAiCallCount = 0
  if (
    legacyConfig.openaiApiKey &&
    shouldRunOpenAiTiebreak(
      scoredCandidates.map((c) => ({ finalScore: c.ranking.finalScore })),
      engineConfig,
    )
  ) {
    try {
      const pool = selectTiebreakPool(scoredCandidates, engineConfig.openAiMaxCandidates)
      const openaiClient = createOpenAIClient({ apiKey: legacyConfig.openaiApiKey })
      const queryImageDataUrl = bytesToDataUrl(sanitizeImageBytes(bytes, file.type), file.type)

      const rerankInputs = await Promise.all(
        pool.map(async (c) => {
          const detail = details.get(c.productId)
          const storagePath = storagePaths.get(c.candidate.bestProductImageId)
          const dataUrl = storagePath ? await dbPort.downloadImageAsDataUrl(storagePath) : null
          return {
            productId: c.productId,
            ci: detail?.ci ?? c.productId,
            brand: detail?.brand ?? null,
            type: null,
            referenceCodes: detail?.reference ? [detail.reference] : [],
            distinctiveFeatures: [],
            imageDataUrl: dataUrl ?? queryImageDataUrl,
          }
        }),
      )

      const verdicts = await rerankVisualCandidates(openaiClient, {
        model: legacyConfig.rerankModel,
        queryImageDataUrl,
        candidates: rerankInputs,
      })
      usedOpenAi = true
      openAiCallCount = 1

      const verdictMap = new Map<string, RerankCandidateResult>(verdicts.map((v) => [v.product_id, v]))
      const tiebroken = applyOpenAiVerdicts(
        scoredCandidates.map((c) => ({
          productId: c.productId,
          finalScore: c.ranking.finalScore,
          matchType: c.ranking.matchType,
          similarityLabel: c.ranking.similarityLabel,
        })),
        verdictMap,
      )
      const byProductId = new Map(tiebroken.map((t) => [t.productId, t]))
      scoredCandidates = scoredCandidates
        .map((c) => {
          const updated = byProductId.get(c.productId)
          if (!updated) return c
          return { ...c, ranking: { ...c.ranking, finalScore: updated.finalScore, matchType: updated.matchType, similarityLabel: updated.similarityLabel } }
        })
        .sort((a, b) => b.ranking.finalScore - a.ranking.finalScore)
    } catch (err) {
      // The tie-break is a nudge, not a requirement — never fail the search over it.
      console.error(`[visual-product-search:${searchId}] OpenAI tie-break failed (non-fatal):`, err instanceof Error ? err.message : err)
    }
  }

  const topCandidates = scoredCandidates.slice(0, MAX_RESULTS)
  const results: VisualProductResultV2[] = topCandidates
    .map((c, index) => {
      const detail = details.get(c.productId)
      if (!detail) return null
      const matchedImagePath = storagePaths.get(c.candidate.bestProductImageId) ?? detail.primaryImagePath
      return buildResultV2(detail, index + 1, {
        globalVisualSimilarity: c.candidate.bestSimilarity,
        localVisualSimilarity: localSimilarityByProduct.get(c.productId) ?? null,
        metadataScore: 0,
        consensusBonus: c.candidate.consensusBonus,
        isExactReferenceMatch: false,
      }, matchedImagePath, c.ranking)
    })
    .filter((r): r is VisualProductResultV2 => r !== null)

  const response = buildVisualResponse({
    searchId, scopeForResponse, results, indexedImagesInScope, rawImagesRetrieved: rawMatches.length,
    uniqueProductsRetrieved: grouped.length, localRerankCandidates: localRerankPool.length, usedLocalOcr,
    usedLocalReranking, usedOpenAi, openAiCallCount, startedAt, engineConfig,
  })

  await cacheResponse(dbPort, cacheKey, queryImageSha256, scope.selectedCategoryId, engineConfig, response)
  return json(response, 200)
}

function buildResultV2(
  detail: ProductDetailRowV2,
  position: number,
  ranking: { globalVisualSimilarity: number; localVisualSimilarity: number | null; metadataScore: number; consensusBonus: number; isExactReferenceMatch: boolean },
  matchedImagePath: string | null,
  precomputed?: { finalScore: number; matchType: VisualProductResultV2['matchType']; similarityLabel: VisualProductResultV2['similarityLabel'] },
): VisualProductResultV2 {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const computed = precomputed ?? computeRanking(ranking)

  return {
    position,
    productId: detail.productId,
    ci: detail.ci,
    reference: detail.reference,
    name: detail.name,
    brand: detail.brand,
    categoryId: detail.categoryId,
    categoryName: detail.categoryName,
    primaryImageUrl: detail.primaryImagePath ? buildPublicImageUrl(supabaseUrl, detail.primaryImagePath) : null,
    matchedImageId: matchedImagePath ?? detail.productId,
    matchedImageUrl: matchedImagePath ? buildPublicImageUrl(supabaseUrl, matchedImagePath) : '',
    globalVisualSimilarity: ranking.globalVisualSimilarity,
    localVisualSimilarity: ranking.localVisualSimilarity,
    metadataScore: ranking.metadataScore,
    consensusBonus: ranking.consensusBonus,
    finalScore: computed.finalScore,
    matchType: computed.matchType,
    similarityLabel: computed.similarityLabel,
    compatibilitySummary: detail.compatibilitySummary,
    productUrl: `/p/${detail.productId}`,
  }
}

function buildVisualResponse(params: {
  searchId: string
  scopeForResponse: VisualProductSearchResponseV2['scope']
  results: VisualProductResultV2[]
  indexedImagesInScope: number
  rawImagesRetrieved: number
  uniqueProductsRetrieved: number
  localRerankCandidates: number
  usedLocalOcr: boolean
  usedLocalReranking: boolean
  usedOpenAi: boolean
  openAiCallCount: number
  startedAt: number
  engineConfig: VisualEngineConfig
}): VisualProductSearchResponseV2 {
  const hasExactMatch = params.results.some((r) => r.matchType === 'exact_reference')
  return {
    searchId: params.searchId,
    scope: params.scopeForResponse,
    status: determineResponseStatus({
      indexedImagesInScope: params.indexedImagesInScope,
      hasExactMatch,
      resultCount: params.results.length,
    }),
    results: params.results,
    meta: {
      engine: 'visual',
      provider: params.engineConfig.embeddingProvider,
      model: params.engineConfig.embeddingModel,
      modelVersion: params.engineConfig.embeddingVersion,
      indexedImagesInScope: params.indexedImagesInScope,
      rawImagesRetrieved: params.rawImagesRetrieved,
      uniqueProductsRetrieved: params.uniqueProductsRetrieved,
      localRerankCandidates: params.localRerankCandidates,
      resultsReturned: params.results.length,
      usedLocalOcr: params.usedLocalOcr,
      usedLocalReranking: params.usedLocalReranking,
      usedOpenAi: params.usedOpenAi,
      openAiCallCount: params.openAiCallCount,
      processingTimeMs: Date.now() - params.startedAt,
      cacheHit: false,
    },
  }
}

function buildEmptyResponse(
  searchId: string,
  scopeForResponse: VisualProductSearchResponseV2['scope'],
  status: 'not_indexed' | 'no_results',
  startedAt: number,
  engineConfig: VisualEngineConfig,
  indexedImagesInScope: number,
): VisualProductSearchResponseV2 {
  return {
    searchId,
    scope: scopeForResponse,
    status,
    results: [],
    meta: {
      engine: 'visual',
      provider: engineConfig.embeddingProvider,
      model: engineConfig.embeddingModel,
      modelVersion: engineConfig.embeddingVersion,
      indexedImagesInScope,
      rawImagesRetrieved: 0,
      uniqueProductsRetrieved: 0,
      localRerankCandidates: 0,
      resultsReturned: 0,
      usedLocalOcr: false,
      usedLocalReranking: false,
      usedOpenAi: false,
      openAiCallCount: 0,
      processingTimeMs: Date.now() - startedAt,
      cacheHit: false,
    },
  }
}

async function cacheResponse(
  dbPort: ReturnType<typeof createSearchDbPort>,
  cacheKey: string,
  queryImageSha256: string,
  categoryId: string | null,
  engineConfig: VisualEngineConfig,
  response: VisualProductSearchResponseV2,
): Promise<void> {
  await dbPort.setVisualSearchCache({
    cacheKey,
    queryImageSha256,
    categoryId,
    provider: engineConfig.embeddingProvider,
    model: engineConfig.embeddingModel,
    modelVersion: engineConfig.embeddingVersion,
    preprocessingVersion: engineConfig.preprocessingVersion,
    rankingVersion: RANKING_VERSION,
    responsePayload: response,
    expiresAt: computeCacheExpiry(engineConfig.cacheTtlMinutes),
  })
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// ============================================================
// LEGACY pipeline: OpenAI text-embedding (unchanged behavior),
// reshaped into the V2 contract at the end.
// ============================================================

async function runLegacyPipeline(params: {
  req: Request
  searchId: string
  startedAt: number
  file: File
  bytes: Uint8Array
  scope: Awaited<ReturnType<typeof resolveCategoryScope>>
  scopeForResponse: VisualProductSearchResponseV2['scope']
  includedCategoryIds: string[] | null
  selectedCategoryName: string | null
  legacyConfig: ReturnType<typeof loadConfig>
  dbPort: ReturnType<typeof createSearchDbPort>
  // deno-lint-ignore no-explicit-any
  supabase: any
}): Promise<Response> {
  const { searchId, startedAt, file, bytes, scope, scopeForResponse, includedCategoryIds, selectedCategoryName, legacyConfig, dbPort } = params

  if (!legacyConfig.openaiApiKey) {
    console.error(`[visual-product-search:${searchId}] Missing OPENAI_API_KEY secret`)
    return errorResponse('openai_unavailable', 'La búsqueda visual no está disponible en este momento.', searchId, 503)
  }

  const indexedImagesInScope = await dbPort.countIndexedImagesInScope(includedCategoryIds).catch(() => 0)
  if (indexedImagesInScope === 0) {
    const response = buildLegacyResponseV2({
      searchId, scope: scopeForResponse, indexedImagesInScope: 0, candidatesRetrieved: 0,
      results: [], hasExactMatch: false, processingTimeMs: Date.now() - startedAt, usedOpenAi: false, openAiCallCount: 0,
    })
    await logLegacyEvent(dbPort, scope, includedCategoryIds, 'no_match', null, 0, 0, startedAt, legacyConfig)
    return json(response, 200)
  }

  const sanitized = sanitizeImageBytes(bytes, file.type)
  const queryImageDataUrl = bytesToDataUrl(sanitized, file.type)
  const openaiClient = createOpenAIClient({ apiKey: legacyConfig.openaiApiKey })

  const analysis = await analyzeAutomotivePartImage(openaiClient, {
    imageDataUrl: queryImageDataUrl,
    model: legacyConfig.visionModel,
    categoryContext: selectedCategoryName,
  })

  if (!analysis.isAutomotivePart) {
    const response = buildLegacyResponseV2({
      searchId, scope: scopeForResponse, indexedImagesInScope, candidatesRetrieved: 0,
      results: [], hasExactMatch: false, processingTimeMs: Date.now() - startedAt, usedOpenAi: true, openAiCallCount: 1,
    })
    await logLegacyEvent(dbPort, scope, includedCategoryIds, 'no_match', null, 0, 0, startedAt, legacyConfig)
    return json(response, 200)
  }

  let openAiCallCount = 1 // the vision analysis call above

  // ── Deterministic exact match ────────────────────────────────────────────
  const exactQuery = { ci: null, referenceCodes: [...analysis.referenceCodes, ...analysis.barcodes], oemCodes: analysis.oemCodes }
  let exactCandidateId: string | null = null
  if (exactQuery.referenceCodes.length > 0 || exactQuery.oemCodes.length > 0) {
    const candidates = await dbPort.fetchExactMatchCandidates(includedCategoryIds)
    const matches = findExactReferenceMatches(exactQuery, candidates, includedCategoryIds)
    const uniqueProductIds = Array.from(new Set(matches.map((m) => m.productId)))
    if (uniqueProductIds.length === 1) exactCandidateId = uniqueProductIds[0]
  }

  if (exactCandidateId) {
    const details = await dbPort.fetchProductDetails([exactCandidateId])
    const detail = details.get(exactCandidateId)
    if (detail) {
      const score = calculateVisualSearchScore({ productId: exactCandidateId, similarityScore: 1, rerank: null, isExactReferenceMatch: true })
      const result = buildLegacyResultV2({ detail, score, matchedImageStoragePath: null }, 1, Deno.env.get('SUPABASE_URL') ?? '', buildPublicImageUrl)
      const response = buildLegacyResponseV2({
        searchId, scope: scopeForResponse, indexedImagesInScope, candidatesRetrieved: 1,
        results: [result], hasExactMatch: true, processingTimeMs: Date.now() - startedAt, usedOpenAi: true, openAiCallCount,
      })
      await logLegacyEvent(dbPort, scope, includedCategoryIds, 'exact_match', null, 1, 0, startedAt, legacyConfig)
      return json(response, 200)
    }
  }

  // ── Vector retrieval + single-call rerank ───────────────────────────────
  const queryText = buildQuerySearchText(analysis, selectedCategoryName)
  const queryEmbedding = await generateTextEmbedding(openaiClient, {
    model: legacyConfig.embeddingModel, dimensions: legacyConfig.embeddingDimensions, text: queryText,
  })
  openAiCallCount += 1

  const matchCount = scope.isGlobalSearch ? legacyConfig.globalTopK : legacyConfig.categoryTopK
  const vectorCandidates: VectorCandidate[] = await findVectorCandidates(
    { queryEmbedding, categoryIds: includedCategoryIds, matchCount, minimumSimilarity: 0 },
    { matchByEmbedding: (p) => dbPort.matchByEmbedding(p) },
  )

  if (vectorCandidates.length === 0) {
    const response = buildLegacyResponseV2({
      searchId, scope: scopeForResponse, indexedImagesInScope, candidatesRetrieved: 0,
      results: [], hasExactMatch: false, processingTimeMs: Date.now() - startedAt, usedOpenAi: true, openAiCallCount,
    })
    await logLegacyEvent(dbPort, scope, includedCategoryIds, 'no_match', null, 0, 0, startedAt, legacyConfig)
    return json(response, 200)
  }

  const productDetails = await dbPort.fetchProductDetails(vectorCandidates.map((c) => c.productId))

  const rerankCount = scope.isGlobalSearch ? legacyConfig.globalRerankK : legacyConfig.categoryRerankK
  const rerankPool = vectorCandidates.slice(0, rerankCount)
  const rerankInputs = await Promise.all(
    rerankPool.map(async (candidate) => {
      const detail = productDetails.get(candidate.productId)
      const imageDataUrl = await dbPort.downloadImageAsDataUrl(candidate.storagePath)
      return {
        productId: candidate.productId, ci: detail?.ci ?? candidate.productId, brand: detail?.brand ?? null,
        type: null, referenceCodes: [], distinctiveFeatures: [], imageDataUrl: imageDataUrl ?? queryImageDataUrl,
      }
    }),
  )

  const rerankResults = await rerankVisualCandidates(openaiClient, {
    model: legacyConfig.rerankModel, queryImageDataUrl, candidates: rerankInputs,
  })
  openAiCallCount += 1
  const rerankByProductId = new Map<string, RerankCandidateResult>(rerankResults.map((r) => [r.product_id, r]))

  const scored: CandidateScore[] = rerankPool
    .map((candidate) =>
      calculateVisualSearchScore({
        productId: candidate.productId, similarityScore: candidate.similarity,
        rerank: rerankByProductId.get(candidate.productId) ?? null, isExactReferenceMatch: false,
      }),
    )
    .filter((s) => s.verdict !== null || s.isExactReferenceMatch)

  if (scored.length === 0) {
    const response = buildLegacyResponseV2({
      searchId, scope: scopeForResponse, indexedImagesInScope, candidatesRetrieved: vectorCandidates.length,
      results: [], hasExactMatch: false, processingTimeMs: Date.now() - startedAt, usedOpenAi: true, openAiCallCount,
    })
    await logLegacyEvent(dbPort, scope, includedCategoryIds, 'no_match', null, vectorCandidates.length, rerankPool.length, startedAt, legacyConfig)
    return json(response, 200)
  }

  const classification = classifyVisualSearchResult(scored, legacyConfig)
  const sortedScored = [...scored].sort((a, b) => b.finalScore - a.finalScore)

  const results: VisualProductResultV2[] = sortedScored
    .map((s, index) => {
      const detail = productDetails.get(s.productId)
      if (!detail) return null
      const candidate = rerankPool.find((c) => c.productId === s.productId)
      return buildLegacyResultV2(
        { detail, score: s, matchedImageStoragePath: candidate?.storagePath ?? null },
        index + 1,
        Deno.env.get('SUPABASE_URL') ?? '',
        buildPublicImageUrl,
      )
    })
    .filter((r): r is VisualProductResultV2 => r !== null)

  const hasExactMatch = classification.status === 'exact_match' && Boolean(classification.exactMatchProductId)
  const response = buildLegacyResponseV2({
    searchId, scope: scopeForResponse, indexedImagesInScope, candidatesRetrieved: vectorCandidates.length,
    results, hasExactMatch, processingTimeMs: Date.now() - startedAt, usedOpenAi: true, openAiCallCount,
  })
  await logLegacyEvent(
    dbPort, scope, includedCategoryIds, classification.status, null, vectorCandidates.length, rerankPool.length, startedAt, legacyConfig,
  )
  return json(response, 200)
}

async function logLegacyEvent(
  dbPort: ReturnType<typeof createSearchDbPort>,
  scope: { selectedCategoryId: string | null; includedCategoryIds: string[]; isGlobalSearch: boolean },
  includedCategoryIds: string[] | null,
  status: 'exact_match' | 'likely_match' | 'similar_results' | 'no_match' | 'error',
  errorCode: string | null,
  candidatesRetrieved: number,
  candidatesReranked: number,
  startedAt: number,
  config: ReturnType<typeof loadConfig>,
): Promise<void> {
  await dbPort.logSearchEvent({
    categoryId: scope.selectedCategoryId,
    includedCategoryCount: includedCategoryIds?.length ?? 0,
    isGlobalSearch: scope.isGlobalSearch,
    status,
    errorCode,
    candidatesRetrieved,
    candidatesReranked,
    processingTimeMs: Date.now() - startedAt,
    visionModel: config.visionModel,
    embeddingModel: config.embeddingModel,
    ipHash: null,
  })
}
