// Supabase Edge Function — reindex-catalog-images
// Runtime: Deno
//
// Admin-only batch indexing (spec section 15). Processes a small batch of
// product images that don't yet have a completed analysis at the current
// ANALYSIS_VERSION, and returns progress so the admin panel can call this
// repeatedly ("Continuar") until `remainingCount` reaches 0.
//
// Scans a bounded window (SCAN_WINDOW) ordered by creation date rather than
// the whole table, so this stays cheap on large catalogs; already-completed
// images fall out of the pending set on every call, so repeated calls make
// steady forward progress even though the window itself is fixed-size.

import { loadConfig, ANALYSIS_VERSION } from '../_shared/config.ts'
import { createOpenAIClient } from '../_shared/openaiClient.ts'
import { createServiceRoleClient } from '../_shared/supabaseClient.ts'
import { createSupabaseIndexPort } from '../_shared/supabaseIndexPort.ts'
import { indexProductImage, type IndexImageOutcome } from '../_shared/indexImage.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ['authorization', 'x-client-info', 'apikey', 'content-type'].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_BATCH_SIZE = 5
// Capped at 10: each image can need up to ~2 OpenAI calls with retries/
// backoff (worst case well over a minute per image), and Edge Functions
// have a platform wall-clock limit. A larger cap risks the whole batch
// being killed mid-flight instead of returning a clean partial result.
const MAX_BATCH_SIZE = 10
const SCAN_WINDOW = 500

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface PendingImageRow {
  id: string
  product_image_ai_features: Array<{ status: string; analysis_version: number }> | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { batchSize?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // Empty body is valid — batchSize just falls back to the default.
  }
  const requestedBatchSize = typeof body.batchSize === 'number' ? body.batchSize : DEFAULT_BATCH_SIZE
  const batchSize = Math.min(Math.max(Math.trunc(requestedBatchSize), 1), MAX_BATCH_SIZE)

  const config = loadConfig()
  if (!config.openaiApiKey) {
    console.error('[reindex-catalog-images] Missing OPENAI_API_KEY secret')
    return json({ error: 'Servicio de análisis no configurado' }, 503)
  }

  try {
    const supabase = createServiceRoleClient()
    const port = createSupabaseIndexPort(supabase)
    const openaiClient = createOpenAIClient({ apiKey: config.openaiApiKey })

    const { data, error } = await supabase
      .from('product_images')
      .select('id, product_image_ai_features(status, analysis_version)')
      .order('created_at', { ascending: true })
      .limit(SCAN_WINDOW)

    if (error) throw new Error('database_error')

    const pendingIds = ((data ?? []) as PendingImageRow[])
      .filter(
        (row) =>
          !(row.product_image_ai_features ?? []).some(
            (f) => f.status === 'completed' && f.analysis_version === ANALYSIS_VERSION,
          ),
      )
      .map((row) => row.id)

    const batch = pendingIds.slice(0, batchSize)
    const results: IndexImageOutcome[] = []
    for (const productImageId of batch) {
      results.push(await indexProductImage(port, openaiClient, config, productImageId))
    }

    const succeeded = results.filter((r) => r.status === 'completed' || r.status === 'skipped').length
    const failed = results.filter((r) => r.status === 'failed').length

    return json(
      {
        processedCount: results.length,
        succeeded,
        failed,
        remainingCount: Math.max(0, pendingIds.length - batch.length),
        results,
      },
      200,
    )
  } catch (err) {
    console.error('[reindex-catalog-images] Unexpected error:', err instanceof Error ? err.message : err)
    return json({ error: 'No se pudo continuar la indexación' }, 500)
  }
})
