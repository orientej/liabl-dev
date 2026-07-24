// v23 M1 fix #1 — per-session entry point
// This is the dynamic route a participant lands on when they follow a
// per-session link (e.g., from a booking confirmation email or a QR code
// scanned at check-in). It forwards them to /participant with the session
// ID attached as a query parameter, where the main signing flow lives.
//
// The redirect approach (rather than rendering the flow here) lets the
// main /participant page remain the single canonical entry point, while
// the URL the participant sees is the clean per-session URL.

import { redirect } from 'next/navigation'

export default function SessionRoute({ params }: { params: { sessionId: string } }) {
  // Pass the session ID through to the main participant flow as a query param.
  // The main page reads it via useSearchParams() and uses it for session resolution.
  redirect(`/participant?session=${encodeURIComponent(params.sessionId)}`)
}
