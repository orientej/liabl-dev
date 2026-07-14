// middleware.ts
// v25 Milestone 5 — session refresh + route protection.
// v25 Global Admin Console, impersonation phase — added a narrow carve-out.
//
// Two jobs, both required for cookie-based Supabase auth to work with
// Next.js App Router:
// 1. Refresh the session token on every request. Supabase access tokens
//    expire; without this, a user's session silently goes stale and
//    server-side reads start failing auth even though the browser still
//    has a cookie.
// 2. Redirect unauthenticated visitors away from protected routes,
//    before the page itself ever renders.
//
// Scope note: this protects /operator/* (the login wall) but does NOT
// enforce which operator's data a logged-in user can see — that's the
// database RLS layer, deliberately a separate pass now that auth.uid()
// exists to key policies off of. A user who successfully logs in
// currently sees data scoped by lib/document-engine.ts's application-
// level lookup, not by anything the database itself would refuse to
// hand back to a different query.
//
// Impersonation carve-out: an impersonated session lives ENTIRELY in
// sessionStorage (lib/supabase.ts), never in a cookie — that's the whole
// point, so it can't contaminate the admin's own cookie-based session in
// their original tab. Middleware runs server-side and can only ever see
// cookies, never sessionStorage, so it structurally cannot verify an
// impersonated session. Both the verification page and the ?impersonating=1
// marker on /operator are let through without a cookie present; the real
// check happens client-side (app/operator/page.tsx reads sessionStorage)
// and, more importantly, real authorization is enforced by RLS on every
// actual data query regardless of what middleware does — this carve-out
// only affects the early convenience redirect, not actual data access.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_OPERATOR_PATHS = ['/operator/login', '/operator/impersonate']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Required even when we don't use the result directly — this is what
  // actually performs the token refresh against the cookies above.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isImpersonationEntry = path === '/operator' && request.nextUrl.searchParams.get('impersonating') === '1'
  const isProtectedOperatorPath =
    path.startsWith('/operator') && !PUBLIC_OPERATOR_PATHS.includes(path) && !isImpersonationEntry

  if (isProtectedOperatorPath && !user) {
    const redirectUrl = new URL('/operator/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon.ico
     * - image/font files
     * Participant-facing routes and public marketing pages pass through
     * untouched — the session refresh above is harmless for them, and
     * none of them are gated.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
