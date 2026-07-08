// lib/supabase-server.ts
// v25 Milestone 5 — server-side Supabase client, for middleware and any
// future server components/route handlers that need to read the
// authenticated session. lib/supabase.ts's createClient() remains the
// browser client for 'use client' components — that one doesn't change.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Called from a Server Component, which can't set cookies directly
            // — middleware refreshes the session on every request instead, so
            // this is safe to ignore here.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Same as above — safe to ignore outside middleware/route handlers.
          }
        },
      },
    }
  )
}
