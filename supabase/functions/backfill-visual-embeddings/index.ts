// Supabase Edge Function — backfill-visual-embeddings
// Runtime: Deno
//
// Admin-only batch backfill (spec section 12), mirroring the UX of the
// legacy reindex-catalog-images: call repeatedly ("Continuar") until
// enqueuedCount is 0. Only enqueues pending jobs for images that don't
// already have a completed row at the current active model config
// (enqueue_missing_visual_embedding_jobs skips everything else) — this
// never calls the inference service itself. Call visual-embedding-worker
// afterwards (or let the scheduled worker run) to actually process the
// newly-enqueued jobs.
//
// Also used after a model/version bump: bumping VISUAL_EMBEDDING_VERSION
// (or _MODEL/_PROVIDER) and calling this repeatedly re-enqueues every image
// for the new version, without touching the old version's rows.
//
// action: 'backfill' (default) enqueues missing images.
// action: 'retry_failed' explicitly resets permanently-failed jobs back to
// 'pending' — this never happens automatically (see the migration comments
// on claim_visual_embedding_jobs vs retry_failed_visual_embedding_jobs).

import { loadVisualEngineConfig } from '../_shared/config.ts'
import { createServiceRoleClient } from '../_shared/supabaseClient.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ['authorization', 'x-client-info', 'apikey', 'content-type'].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_BATCH_SIZE = 100
const MAX_BATCH_SIZE = 500

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { batchSize?: unknown; action?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is valid.
  }
  const requestedBatchSize = typeof body.batchSize === 'number' ? body.batchSize : DEFAULT_BATCH_SIZE
  const batchSize = Math.min(Math.max(Math.trunc(requestedBatchSize), 1), MAX_BATCH_SIZE)
  const action = body.action === 'retry_failed' ? 'retry_failed' : 'backfill'

  const config = loadVisualEngineConfig()

  try {
    const supabase = createServiceRoleClient()

    await supabase.rpc('set_visual_embedding_active_config', {
      p_provider: config.embeddingProvider,
      p_model: config.embeddingModel,
      p_model_version: config.embeddingVersion,
      p_dimensions: config.embeddingDimensions,
      p_preprocessing_version: config.preprocessingVersion,
    })

    const rpcName = action === 'retry_failed' ? 'retry_failed_visual_embedding_jobs' : 'enqueue_missing_visual_embedding_jobs'
    const { data: affectedCount, error } = await supabase.rpc(rpcName, { p_batch_size: batchSize })
    if (error) throw new Error('database_error')

    const { count: remainingPendingCount, error: countError } = await supabase
      .from('product_image_visual_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (countError) throw new Error('database_error')

    const { count: remainingFailedCount, error: failedCountError } = await supabase
      .from('product_image_visual_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
    if (failedCountError) throw new Error('database_error')

    return json(
      {
        action,
        enqueuedCount: action === 'backfill' ? affectedCount ?? 0 : 0,
        retriedCount: action === 'retry_failed' ? affectedCount ?? 0 : 0,
        remainingPendingCount: remainingPendingCount ?? 0,
        remainingFailedCount: remainingFailedCount ?? 0,
      },
      200,
    )
  } catch (err) {
    console.error('[backfill-visual-embeddings] Unexpected error:', err instanceof Error ? err.message : err)
    return json({ error: 'No se pudo continuar el backfill' }, 500)
  }
})
