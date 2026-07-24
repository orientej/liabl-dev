// lib/supabase-anon.ts
// Genuinely anonymous Supabase client for the participant-facing signing
// flow only. Deliberately NOT createBrowserClient from @supabase/ssr —
// that factory is specifically designed to sync with whatever Supabase
// auth session cookie exists on the domain, which is exactly right for
// the operator dashboard and admin console (lib/supabase.ts), but wrong
// here.
//
// If the same browser also has an operator or admin session open in
// another tab (very plausible during internal testing, or a staff
// member demoing their own operator's signup flow), the participant
// page would silently inherit THAT session instead of behaving as a
// genuinely anonymous visitor. auth.role() would then resolve to
// 'authenticated', not 'anon' — and every RLS policy scoped to
// auth.role() = 'anon' (participants, waivers, audit_events) correctly
// rejects the write, since it's not actually coming from an anonymous
// caller. That's the exact "new row violates row-level security policy
// for table participants" error this fixes.
//
// This client never reads or writes any session cookie or localStorage
// at all — every request uses only the anon API key, matching what an
// actual member of the public scanning a QR code would be, regardless
// of what else might be logged into the same browser.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
