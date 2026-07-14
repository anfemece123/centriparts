// Supabase Edge Function — visual-embedding-worker
// Runtime: Deno
//
// Admin-only. verify_jwt defaults to true (not overridden in
// supabase/config.toml) — same convention as index-product-image /
// reindex-catalog-images: an authenticated admin session (or a scheduled
// invocation using the service role key) is required.
//
// Unifies three things the spec asks for separately into one worker:
//   - Auto-indexing of newly uploaded images (section 11) — they arrive
//     here as 'pending' rows created by the DB trigger.
//   - Backfill of old images (section 12) — same 'pending' rows, created
//     instead by enqueue_missing_visual_embedding_jobs via
//     backfill-visual-embeddings.
//   - Stuck-job recovery (section 9) — claim_visual_embedding_jobs reclaims
//     'processing' rows that have been stuck past the staleness window.
//
// Claiming is atomic (FOR UPDATE SKIP LOCKED in SQL), so running this on a
// schedule AND letting an admin click "Procesar pendientes" at the same
// time can never double-process a row.
//
// Invoke on a schedule (Supabase scheduled Edge Functions / pg_cron, or any
// external cron hitting this URL with the service role key) so new images
// get indexed without anyone needing to keep the admin tab open.
//
// Supabase secrets required (`supabase secrets set`):
//   VISUAL_INFERENCE_SERVICE_URL — private URL of services/visual-search-inference.
//   VISUAL_INFERENCE_API_KEY     — shared secret, matches the service's VISUAL_INTERNAL_API_KEY.

import { loadVisualEngineConfig } from '../_shared/config.ts'
import { createServiceRoleClient } from '../_shared/supabaseClient.ts'
import { createVisualInferenceClient } from '../_shared/visualEmbeddingClient.ts'
import { createSupabaseVisualEmbeddingPort } from '../_shared/supabaseVisualEmbeddingPort.ts'
import {
  processVisualEmbeddingJob,
  type ClaimedVisualEmbeddingJob,
  type VisualEmbeddingJobResult,
} from '../_shared/visualEmbeddingJobProcessor.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ['authorization', 'x-client-info', 'apikey', 'content-type'].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface RawJobRow {
  id: string
  product_id: string
  product_image_id: string
  provider: string
  model: string
  model_version: string
  dimensions: number
  preprocessing_version: string
}

function toClaimedJob(row: RawJobRow): ClaimedVisualEmbeddingJob {
  return {
    id: row.id,
    productId: row.product_id,
    productImageId: row.product_image_id,
    provider: row.provider,
    model: row.model,
    modelVersion: row.model_version,
    dimensions: row.dimensions,
    preprocessingVersion: row.preprocessing_version,
  }
}

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += Math.max(1, concurrency)) {
    const chunk = items.slice(i, i + Math.max(1, concurrency))
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { batchSize?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is valid — batchSize just falls back to the configured default.
  }

  const config = loadVisualEngineConfig()
  if (!config.inferenceServiceUrl || !config.inferenceServiceApiKey) {
    console.error('[visual-embedding-worker] Missing VISUAL_INFERENCE_SERVICE_URL/VISUAL_INFERENCE_API_KEY secret')
    return json({ error: 'Servicio de inferencia visual no configurado' }, 503)
  }

  try {
    const supabase = createServiceRoleClient()

    // Keep the DB's "active model" singleton in sync with this worker's own
    // config on every run, so the auto-enqueue trigger always stamps new
    // jobs with the model that's actually running (see the migration).
    await supabase.rpc('set_visual_embedding_active_config', {
      p_provider: config.embeddingProvider,
      p_model: config.embeddingModel,
      p_model_version: config.embeddingVersion,
      p_dimensions: config.embeddingDimensions,
      p_preprocessing_version: config.preprocessingVersion,
    })

    const batchSize = typeof body.batchSize === 'number' ? body.batchSize : config.indexBatchSize

    const { data, error } = await supabase.rpc('claim_visual_embedding_jobs', {
      p_batch_size: batchSize,
      p_stale_minutes: config.indexStaleProcessingMinutes,
      p_max_attempts: config.indexMaxAttempts,
    })
    if (error) throw new Error('database_error')

    const jobs = ((data ?? []) as RawJobRow[]).map(toClaimedJob)

    const inferenceClient = createVisualInferenceClient({
      baseUrl: config.inferenceServiceUrl,
      apiKey: config.inferenceServiceApiKey,
    })
    const port = createSupabaseVisualEmbeddingPort(supabase, inferenceClient)

    const results: VisualEmbeddingJobResult[] = await processInBatches(jobs, config.indexMaxConcurrency, (job) =>
      processVisualEmbeddingJob(port, job),
    )

    const completed = results.filter((r) => r.status === 'completed').length
    const failed = results.filter((r) => r.status === 'failed').length

    return json({ claimed: jobs.length, completed, failed, results }, 200)
  } catch (err) {
    console.error('[visual-embedding-worker] Unexpected error:', err instanceof Error ? err.message : err)
    return json({ error: 'No se pudo procesar el lote de embeddings visuales' }, 500)
  }
})
