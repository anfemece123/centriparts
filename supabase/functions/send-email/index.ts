// Supabase Edge Function — send-email
// Runtime: Deno
//
// JWT verification is disabled (verify_jwt = false in config.toml) because this
// function is invoked from public/unauthenticated contexts (e.g. checkout page)
// and the new Supabase publishable key format (sb_publishable_*) is not a JWT.
//
// Security is handled via the x-internal-secret header validated below.
//
// Supabase secrets required (set via `supabase secrets set`):
//   RESEND_API_KEY    — from resend.com dashboard
//   RESEND_FROM       — verified sender, e.g. "Centriparts <noreply@tu-dominio.com>"
//   FUNCTION_SECRET   — arbitrary secret; must match VITE_FUNCTION_SECRET in frontend .env

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-internal-secret',   // <── required for the secret check below
  ].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailPayload {
  to:       string
  subject:  string
  html:     string
  replyTo?: string
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Secret validation ─────────────────────────────────────────────────────
  // FUNCTION_SECRET is optional: if not set, the check is skipped (dev/test mode).
  // In production this secret MUST be set so that only our frontend can invoke
  // this function after JWT verification was disabled.
  const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')
  if (FUNCTION_SECRET) {
    const incoming = req.headers.get('x-internal-secret')
    if (incoming !== FUNCTION_SECRET) {
      console.warn('[send-email] Rejected request: invalid or missing x-internal-secret')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Read Resend config ────────────────────────────────────────────────────
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const RESEND_FROM    = Deno.env.get('RESEND_FROM') ?? 'Centriparts <onboarding@resend.dev>'

  if (!RESEND_API_KEY) {
    console.error('[send-email] Missing RESEND_API_KEY secret')
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: EmailPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!payload.to || !payload.subject || !payload.html) {
    return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Call Resend ───────────────────────────────────────────────────────────
  try {
    const body: Record<string, unknown> = {
      from:    RESEND_FROM,
      to:      [payload.to],
      subject: payload.subject,
      html:    payload.html,
    }
    if (payload.replyTo) {
      body.reply_to = payload.replyTo
    }

    console.log(`[send-email] Sending to ${payload.to} — subject: "${payload.subject}"`)

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[send-email] Resend error:', res.status, text)
      return new Response(JSON.stringify({ error: 'Email provider error', detail: text }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    console.log('[send-email] Sent successfully, id:', data?.id)

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-email] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
