// lib/supabase.ts
// Browser Supabase client for operator/admin dashboard use (client
// components with 'use client'). Participant-facing code uses
// lib/supabase-anon.ts instead — see that file for why.
//
// v25 Global Admin Console, impersonation phase — this factory is now
// impersonation-aware. Cookies (createBrowserClient's storage) are
// shared across every tab in a browser, so an impersonated session
// cannot safely live there without risking the admin's own login in
// their original tab. When impersonation is active (a flag set in
// sessionStorage by app/operator/impersonate/page.tsx), this returns a
// plain supabase-js client backed by sessionStorage instead — genuinely
// per-tab, so the two identities never touch. Every existing call site
// across the operator dashboard (RosterTab, AnalyticsTab, TemplateTab,
// etc.) already goes through this same function, so none of them need
// to change to support impersonation correctly.

import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const IMPERSONATION_FLAG_KEY = 'liabl_impersonating'

export function createClient() {
  const isImpersonating =
    typeof window !== 'undefined' && sessionStorage.getItem(IMPERSONATION_FLAG_KEY) === 'true'

  if (isImpersonating) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }
    )
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
