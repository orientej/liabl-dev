// app/developers/route.ts
// The public developer documentation page. Serves a self-contained HTML
// document that renders the OpenAPI contract (GET /api/v1/openapi) with
// Redoc. Implemented as a route handler returning text/html rather than a
// React page so Redoc's standalone bundle owns the DOM without competing
// with Next's hydration.
//
// PUBLIC: no auth. The spec it loads carries the full getting-started guide
// (auth, scopes, rate limits, test mode, and the webhook signature-
// verification snippet) in its info.description, so this shell stays thin.
//
// Redoc loads the spec relatively ('/api/v1/openapi'), so the docs work on
// whatever host serves them (api.liabl.ai/developers, the operator host, a
// preview deployment) without hardcoding an origin.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HTML = `<!doctype html>
<html>
  <head>
    <title>Liabl API — Developer Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Liabl public API: create bookings, track waiver signatures, and receive signed webhooks." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/api/v1/openapi" hide-download-button></redoc>
    <script src="https://cdn.redocly.com/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`

export async function GET() {
  return new NextResponse(HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
