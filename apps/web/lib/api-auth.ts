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
import { ACCESS_TOKEN_PREFIX } from '@/lib/oauth'

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
export const RATE_LIMIT_PER_MIN = 120

export interface ApiContext {
  operatorId: string
  scopes: string[]
  mode: 'live' | 'test'
  // Requests remaining in the current 60s window (for X-RateLimit-Remaining).
  // Set during authentication; handlers pass ctx to apiResponse to surface it.
  remaining: number
  // The calling principal — exactly one is set (an API key, or an OAuth
  // access token's client). Used for per-principal rate limiting + audit.
  apiKeyId?: string | null
  oauthClientId?: string | null
}

export function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Success responses go through here so every /api/v1 reply carries the
 * standard developer-platform headers: the rate-limit budget (so clients
 * can self-throttle) and which key mode served the request (live/test).
 */
export function apiResponse(ctx: ApiContext, body: unknown, init?: { status?: number }): NextResponse {
  const res = NextResponse.json(body, init)
  res.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_PER_MIN))
  res.headers.set('X-RateLimit-Remaining', String(Math.max(0, ctx.remaining)))
  res.headers.set('X-Liabl-Mode', ctx.mode)
  return res
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
      api_key_id:      ctx.apiKeyId ?? null,
      oauth_client_id: ctx.oauthClientId ?? null,
      operator_id:     ctx.operatorId,
      method:          request.method,
      path:            new URL(request.url).pathname,
      status_code:     statusCode,
      ip_address:      clientIp(request),
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

  // Resolve the principal: an OAuth access token (liabl_at_…) or an API key.
  // Both arrive as `Authorization: Bearer <token>` and are told apart by the
  // token prefix, so every /api/v1 route works with either unchanged.
  let operatorId: string
  let scopes: string[]
  let mode: 'live' | 'test'
  let apiKeyId: string | null = null
  let oauthClientId: string | null = null

  if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
    const { data: at, error } = await admin
      .from('oauth_access_tokens')
      .select('client_id, operator_id, scopes, mode, expires_at')
      .eq('token_hash', sha256hex(token))
      .maybeSingle()
    if (error) return { response: apiError(500, 'server_error', 'Could not verify the access token.') }
    if (!at)   return { response: apiError(401, 'invalid_token', 'Invalid access token.') }
    if (new Date(at.expires_at) < new Date()) {
      return { response: apiError(401, 'expired', 'This access token has expired. Request a new one from /api/oauth/token.') }
    }
    operatorId = at.operator_id; scopes = at.scopes ?? []; mode = at.mode; oauthClientId = at.client_id
  } else {
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
    operatorId = key.operator_id; scopes = key.scopes ?? []; mode = key.mode; apiKeyId = key.id
  }

  const ctx: ApiContext = { operatorId, scopes, mode, remaining: RATE_LIMIT_PER_MIN, apiKeyId, oauthClientId }

  if (!scopes.includes(required)) {
    await logApiRequest(admin, ctx, request, 403)
    return { response: apiError(403, 'insufficient_scope', `This credential lacks the required scope: ${required}.`) }
  }

  // Rate limit — count this principal's requests in the trailing 60 seconds.
  const since = new Date(Date.now() - 60_000).toISOString()
  let countQuery = admin
    .from('api_request_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  countQuery = apiKeyId ? countQuery.eq('api_key_id', apiKeyId) : countQuery.eq('oauth_client_id', oauthClientId!)
  const { count } = await countQuery
  const used = count ?? 0
  if (used >= RATE_LIMIT_PER_MIN) {
    await logApiRequest(admin, ctx, request, 429)
    const res = apiError(429, 'rate_limited', `Rate limit exceeded (${RATE_LIMIT_PER_MIN} requests per minute). Please retry shortly.`)
    res.headers.set('Retry-After', '60')
    res.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_PER_MIN))
    res.headers.set('X-RateLimit-Remaining', '0')
    return { response: res }
  }
  // This request will consume one slot; report what's left after it.
  ctx.remaining = Math.max(0, RATE_LIMIT_PER_MIN - used - 1)

  // Touch last_used_at on the principal (fire-and-forget).
  if (apiKeyId) {
    admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId).then(() => {}, () => {})
  } else if (oauthClientId) {
    admin.from('oauth_clients').update({ last_used_at: new Date().toISOString() }).eq('id', oauthClientId).then(() => {}, () => {})
  }

  return { ctx, admin }
}
