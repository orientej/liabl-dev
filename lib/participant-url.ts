// lib/participant-url.ts
// Single source of truth for building participant-facing check-in URLs.
//
// WHY THIS EXISTS
// Check-in links were previously built from `window.location.origin` at
// each call site. That works while every surface shares one domain, but
// breaks in two ways once the operator console moves to its own host:
//
//   1. NEWLY generated links would point at the operator host. An
//      operator on admin.liabl.ai would produce
//      admin.liabl.ai/participant/session/... — the wrong host for a
//      public, unauthenticated visitor.
//   2. EXISTING QR codes already encode whatever origin was current when
//      they were generated. Those are printed, laminated, and posted at
//      trailheads; they have no expiry and cannot be reissued. See
//      middleware.ts for the redirect that keeps them working.
//
// Setting NEXT_PUBLIC_PARTICIPANT_URL fixes (1). Until it is set, this
// falls back to the current origin — byte-for-byte today's behavior, so
// this module can ship well ahead of any domain change.
//
// DEPLOYMENT ORDER MATTERS: only set NEXT_PUBLIC_PARTICIPANT_URL once
// the participant host actually resolves. Setting it early points both
// new links and the middleware redirect at a host that isn't serving
// yet.

/**
 * Base URL for participant-facing pages, without a trailing slash.
 * Returns null when unset and no origin is available (server-side render
 * with no configuration), so callers can decide how to degrade.
 */
export function participantBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_PARTICIPANT_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return null
}

/**
 * Full check-in URL for a session — what goes into the copyable link and
 * the QR code. Returns an empty string when no base URL can be resolved,
 * matching the previous behavior of the SSR guard at the call sites
 * (they render an empty field rather than a broken link).
 */
export function participantCheckInUrl(sessionId: string): string {
  const base = participantBaseUrl()
  return base ? `${base}/participant/session/${sessionId}` : ''
}
