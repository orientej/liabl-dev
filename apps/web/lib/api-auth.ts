// lib/api-auth.ts
// Public API v1 — the authentication + authorization + rate-limit + audit
// wrapper every /api/v1 route goes through. SERVER-ONLY (imports node
// crypto and the service-role client) — never import from a client
// component.
//
// The one non-negotiable job: derive the operator from the API KEY, never
// from the request body. Handlers receive an ApiContext with operatorId
// resolved from the key and must scope every query to it — a client can
// then never touch another operator's data.

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const API_SCOPES = [
  'reservations:read',
  'reservations:write',
  'sessions:write',
  'waivers:read',
  'webhooks:manage',
] as const
export type ApiScope = (typeof API_SCOPES)[number]

// v1 rate limit: fixed 120 requests / rolling 60s per key, counted from
// the api_request_log (Postgres — no extra infra for v1).
const RATE_LIMIT_PER_MIN = 120

export interface ApiContext {
  keyId: string
  operatorId: string
  scopes: string[]
  mode: 'live' | 'test'
}

export function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

function sha256hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

function clientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null
}

/** Generates a new API key: the plaintext (returned once), plus the
 *  prefix/last4/hash that are all we ever store. */
export function generateApiKey(mode: 'live' | 'test'): { key: string; prefix: string; last4: string; hash: string } {
  const random = crypto.randomBytes(24).toString('base64url')
  const key = `liabl_${mode}_${random}`
  return { key, prefix: key.slice(0, 16), last4: key.slice(-4), hash: sha256hex(key) }
}

type AdminClient = ReturnType<typeof createAdminClient>

/** Writes one api_request_log row. Fire-and-forget — logging must never
 *  break the response. Call at the end of a handler with the final status. */
export async function logApiRequest(admin: AdminClient, ctx: ApiContext, request: NextRequest, statusCode: number): Promise<void> {
  try {
    await admin.from('api_request_log').insert({
      api_key_id:  ctx.keyId,
      operator_id: ctx.operatorId,
      method:      request.method,
      path:        new URL(request.url).pathname,
      status_code: statusCode,
      ip_address:  clientIp(request),
    })
  } catch { /* non-fatal */ }
}

/**
 * Authenticate + authorize + rate-limit an /api/v1 request.
 * Returns { ctx, admin } on success (reuse the admin client for the
 * handler's queries — always filtered by ctx.operatorId), or { response }
 * — an error Response the handler should return as-is. Failures are logged
 * where a key was identified; on success the HANDLER logs the final status
 * via logApiRequest.
 */
export async function authenticateApiRequest(
  request: NextRequest,
  required: ApiScope,
): Promise<{ ctx: ApiContext; admin: AdminClient } | { response: NextResponse }> {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return { response: apiError(401, 'unauthorized', 'Missing API key. Send it as: Authorization: Bearer <key>.') }
  }

  const token = match[1].trim()
  const admin = createAdminClient()
  const { data: key, error } = await admin
    .from('api_keys')
    .select('id, operator_id, scopes, mode, revoked_at, expires_at')
    .eq('key_hash', sha256hex(token))
    .maybeSingle()

  if (error)  return { response: apiError(500, 'server_error', 'Could not verify the API key.') }
  if (!key)   return { response: apiError(401, 'invalid_key', 'Invalid API key.') }
  if (key.revoked_at) return { response: apiError(401, 'revoked', 'This API key has been revoked.') }
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { response: apiError(401, 'expired', 'This API key has expired.') }
  }

  const scopes: string[] = key.scopes ?? []
  const ctx: ApiContext = { keyId: key.id, operatorId: key.operator_id, scopes, mode: key.mode }

  if (!scopes.includes(required)) {
    await logApiRequest(admin, ctx, request, 403)
    return { response: apiError(403, 'insufficient_scope', `This key lacks the required scope: ${required}.`) }
  }

  // Rate limit — count this key's requests in the trailing 60 seconds.
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await admin
    .from('api_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', key.id)
    .gte('created_at', since)
  if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
    await logApiRequest(admin, ctx, request, 429)
    return { response: apiError(429, 'rate_limited', `Rate limit exceeded (${RATE_LIMIT_PER_MIN} requests per minute). Please retry shortly.`) }
  }

  // Touch last_used_at (fire-and-forget).
  admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {}, () => {})

  return { ctx, admin }
}
