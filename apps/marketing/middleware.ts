import { NextResponse, type NextRequest } from 'next/server'

// Marketing site middleware — forwarding only. There is no auth here and
// no data layer; this app exists to serve static marketing pages.
//
// WHY IT EXISTS
// Before the domain split, one deployment served marketing, the operator
// console, and participant check-in from the same host. Links to those
// surfaces are still in the world:
//
//   * Printed QR codes and laminated signage encoding
//     <old-host>/participant/session/<id>. These are physical artifacts
//     with no expiry and no way to reissue them.
//   * Operator bookmarks and old invite emails pointing at
//     <old-host>/operator.
//
// If the apex domain is pointed at this project, those requests arrive
// here — at an app that has no such routes — and would 404. Forwarding
// them keeps every previously-valid link working.
//
// 308 for participant paths: permanent and method-preserving, because
// those printed codes are never reissued. 307 for operator paths: a
// correction rather than a permanent address, so it is not cached if the
// host configuration changes later.
//
// Both rules are no-ops until the corresponding environment variable is
// set, so this is safe to deploy before any domain is moved.

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/participant')) {
    const target = originOf(process.env.NEXT_PUBLIC_PARTICIPANT_URL)
    if (target) {
      return NextResponse.redirect(new URL(pathname + search, target), 308)
    }
  }

  if (pathname.startsWith('/operator') || pathname.startsWith('/admin')) {
    const target = originOf(process.env.NEXT_PUBLIC_OPERATOR_URL)
    if (target) {
      return NextResponse.redirect(new URL(pathname + search, target), 307)
    }
  }

  return NextResponse.next()
}

/** Origin of a configured URL, or null when unset or malformed. A bad
 *  value must never take the marketing site down. */
function originOf(configured: string | undefined): string | null {
  const raw = configured?.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

export const config = {
  matcher: ['/participant/:path*', '/operator/:path*', '/admin/:path*'],
}
