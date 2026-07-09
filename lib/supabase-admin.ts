// lib/supabase-admin.ts
// v25 M5 — service-role client, for the retention purge job only.
//
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only env var, never prefixed
// with NEXT_PUBLIC_ — must never reach the browser bundle). Bypasses RLS
// entirely, which is exactly what a system-wide, cross-operator
// maintenance job needs — no operator's own session could do this,
// since RLS correctly restricts every authenticated operator to their
// own rows.
//
// Do not import this from any client component or anywhere reachable
// from the browser. Server-only route handlers (like the retention
// purge route) are the only intended caller.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'The service role key is separate from the anon key — find it in Supabase project settings > API.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
