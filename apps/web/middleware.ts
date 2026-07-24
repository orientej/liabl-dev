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

/**
 * Origin (scheme + host) of a configured URL, or null when unset or
 * malformed. Malformed configuration must never take a surface down, so
 * every caller treats null as "not configured" and serves normally.
 */
function originOf(configured: string | undefined): string | null {
  const raw = configured?.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/** Whether a request host is the host of a configured URL. */
function hostMatches(configured: string | undefined, requestHost: string): boolean {
  const origin = originOf(configured)
  return !!origin && new URL(origin).host === requestHost
}

/**
 * Preview deployments and local development, which get NO host routing —
 * one origin serves every surface there, which is what makes a preview
 * URL useful for testing the participant flow. Without this, preview
 * traffic would be redirected to the live participant domain.
 *
 * Deliberately NOT "any host we don't recognize": the previously-live
 * production host is also unrecognized once traffic moves to the new
 * hosts, and participant links printed while it was canonical must keep
 * redirecting. Only genuinely non-production hosts opt out.
 */
function isNonProductionHost(requestHost: string): boolean {
  const host = requestHost.split(':')[0]
  return host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1'
}

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

  const path = request.nextUrl.pathname

  // ── Host routing ─────────────────────────────────────────────────────
  // Runs BEFORE the auth work below, deliberately: there is no reason to
  // touch session cookies on a request we are about to send elsewhere.
  //
  // The operator console and the participant flow are one deployment
  // served on two hosts. Keeping each surface on its own origin is what
  // makes the separation real rather than cosmetic:
  //
  //   * Participant links and QR codes are permanent physical artifacts.
  //     Ones printed before the split encode the old host, so /participant
  //     requests arriving there are forwarded rather than 404'd.
  //
  //   * The operator console must NOT be reachable on the participant
  //     host. If a staff member logged in at the participant origin — on a
  //     shared check-in tablet, say — that origin would then hold an
  //     operator session cookie, and the participant flow would inherit it
  //     on the next signature. That is exactly the bug lib/supabase-anon.ts
  //     was written to work around: auth.role() resolves to `authenticated`
  //     instead of `anon` and every anon-scoped RLS policy rejects the
  //     write. Separate origins only prevent that if each origin refuses to
  //     serve the other's surface.
  const surfaceHost       = request.nextUrl.host
  const isParticipantHost = hostMatches(process.env.NEXT_PUBLIC_PARTICIPANT_URL, surfaceHost)
  const isOperatorHost    = hostMatches(process.env.NEXT_PUBLIC_OPERATOR_URL, surfaceHost)
  const nonProduction     = isNonProductionHost(surfaceHost)
  const participantOrigin = originOf(process.env.NEXT_PUBLIC_PARTICIPANT_URL)
  const operatorOrigin    = originOf(process.env.NEXT_PUBLIC_OPERATOR_URL)

  // The operator host is a tool, not a website: its root should open the
  // console rather than the marketing home page. Sending it to /operator
  // (not straight to /operator/login) keeps ONE place deciding where an
  // operator lands — the auth rule further down, which forwards to login
  // when signed out and serves the dashboard when signed in.
  if (isOperatorHost && path === '/') {
    return NextResponse.redirect(new URL('/operator', request.url))
  }

  // Participant paths arriving anywhere other than the participant host —
  // the printed-QR-code case. 308 preserves the method and marks it
  // permanent, which is accurate: those codes are never reissued.
  if (!isParticipantHost && !nonProduction && participantOrigin && path.startsWith('/participant')) {
    return NextResponse.redirect(
      new URL(path + request.nextUrl.search, participantOrigin), 308
    )
  }

  // Operator or global-admin paths arriving on the participant host. Sent
  // to the operator origin when it is known, so staff land on the console
  // at the host where their session cookie belongs; 404 otherwise, which
  // is the safe default — better a dead end than an operator login form
  // served on the public check-in origin. 307 rather than 308: this is a
  // correction, not a permanent address, and should not be cached if the
  // host configuration later changes.
  if (isParticipantHost && (path.startsWith('/operator') || path.startsWith('/admin'))) {
    if (operatorOrigin) {
      return NextResponse.redirect(
        new URL(path + request.nextUrl.search, operatorOrigin), 307
      )
    }
    return new NextResponse(null, { status: 404 })
  }

  // Required even when we don't use the result directly — this is what
  // actually performs the token refresh against the cookies above.
  const { data: { user } } = await supabase.auth.getUser()

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
