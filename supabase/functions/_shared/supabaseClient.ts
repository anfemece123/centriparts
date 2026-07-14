// deno-lint-ignore-file no-explicit-any
// Deno-only: creates the service-role Supabase client used by every Edge
// Function in this feature. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// automatically provided to Edge Functions by the Supabase platform — they
// do not need to be set manually via `supabase secrets set`.
//
// Pinned to the exact version used by the frontend (see
// package-lock.json → @supabase/supabase-js) so both runtimes stay in
// sync and Deno's npm: resolution can't silently drift to a newer major.
import { createClient } from 'npm:@supabase/supabase-js@2.99.1'

export function createServiceRoleClient(): any {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
