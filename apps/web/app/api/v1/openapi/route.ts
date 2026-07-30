// app/api/v1/openapi/route.ts
// Serves the OpenAPI 3.1 contract (lib/openapi.ts) as JSON. PUBLIC and
// unauthenticated by design — the contract must be readable by docs
// tooling and by any developer evaluating the API, and it contains no
// secrets. CORS-open so external doc renderers can load it too.

import { NextResponse } from 'next/server'
import { OPENAPI_SPEC } from '@/lib/openapi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
