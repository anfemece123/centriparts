// Supabase Edge Function — index-product-image
// Runtime: Deno
//
// Admin-only. verify_jwt defaults to true (not overridden in
// supabase/config.toml), so only an authenticated (admin) session can
// reach this handler — consistent with how the rest of this project
// treats "authenticated" as the admin role (see order RLS policies).
//
// Responsibilities: analyze a single product image with OpenAI, build its
// search document, generate its embedding, and persist everything to
// product_image_ai_features. Idempotent by (image hash, analysis version).
//
// Supabase secrets required (`supabase secrets set`):
//   OPENAI_API_KEY — never exposed to the frontend.

import { loadConfig } from '../_shared/config.ts'
import { createOpenAIClient } from '../_shared/openaiClient.ts'
import { createServiceRoleClient } from '../_shared/supabaseClient.ts'
import { createSupabaseIndexPort } from '../_shared/supabaseIndexPort.ts'
import { indexProductImage } from '../_shared/indexImage.ts'

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { productImageId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const productImageId = body.productImageId
  if (typeof productImageId !== 'string' || productImageId.length === 0) {
    return json({ error: 'productImageId es requerido' }, 400)
  }

  const config = loadConfig()
  if (!config.openaiApiKey) {
    console.error('[index-product-image] Missing OPENAI_API_KEY secret')
    return json({ error: 'Servicio de análisis no configurado' }, 503)
  }

  try {
    const supabase = createServiceRoleClient()
    const port = createSupabaseIndexPort(supabase)
    const openaiClient = createOpenAIClient({ apiKey: config.openaiApiKey })

    const result = await indexProductImage(port, openaiClient, config, productImageId)
    return json(result, 200)
  } catch (err) {
    console.error('[index-product-image] Unexpected error:', err instanceof Error ? err.message : err)
    return json({ error: 'No se pudo indexar la imagen' }, 500)
  }
})
