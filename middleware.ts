// middleware.ts
// v25 Milestone 5 — session refresh + route protection.
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

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_OPERATOR_PATHS = ['/operator/login']

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
  const isProtectedOperatorPath = path.startsWith('/operator') && !PUBLIC_OPERATOR_PATHS.includes(path)

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
