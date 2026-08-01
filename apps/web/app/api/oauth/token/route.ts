// app/api/oauth/token/route.ts
// Public API — OAuth2 token endpoint (client-credentials grant). A partner
// exchanges client_id + client_secret for a short-lived bearer access token,
// then calls /api/v1 with `Authorization: Bearer <access_token>`.
//
//   POST /api/oauth/token
//     Accepts application/x-www-form-urlencoded or JSON, plus HTTP Basic
//     (client_id:client_secret) per RFC 6749 §2.3.1.
//     Body: grant_type=client_credentials [& scope="a b c"]
//   -> { access_token, token_type: "Bearer", expires_in, scope }
//
// PUBLIC (no session): the credential IS the authentication. Errors use the
// OAuth error shape ({ error, error_description }). Runs on the service-role
// client — the operator is derived from the client, never the request.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { issueAccessToken, sha256hex } from '@/lib/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function oauthError(status: number, error: string, description: string): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status })
}

/** Pull client_id / client_secret from HTTP Basic, then fall back to the
 *  parsed body (form or JSON) per the spec. */
function readCredentials(request: NextRequest, body: Record<string, string>): { clientId?: string; clientSecret?: string } {
  const authz = request.headers.get('authorization') || ''
  const basic = authz.match(/^Basic\s+(.+)$/i)
  if (basic) {
    try {
      const [id, secret] = Buffer.from(basic[1], 'base64').toString('utf8').split(':')
      if (id) return { clientId: id, clientSecret: secret }
    } catch { /* fall through to body */ }
  }
  return { clientId: body.client_id, clientSecret: body.client_secret }
}

async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, string>
  }
  const text = await request.text().catch(() => '')
  return Object.fromEntries(new URLSearchParams(text)) as Record<string, string>
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)

  if ((body.grant_type || '') !== 'client_credentials') {
    return oauthError(400, 'unsupported_grant_type', 'Only grant_type=client_credentials is supported.')
  }

  const { clientId, clientSecret } = readCredentials(request, body)
  if (!clientId || !clientSecret) {
    return oauthError(400, 'invalid_request', 'client_id and client_secret are required.')
  }

  const admin = createAdminClient()
  const { data: client, error } = await admin
    .from('oauth_clients')
    .select('id, operator_id, client_secret_hash, scopes, mode, revoked_at')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) return oauthError(500, 'server_error', 'Could not verify the client.')
  if (!client || client.revoked_at) {
    return oauthError(401, 'invalid_client', 'Unknown or revoked client.')
  }
  // Constant-time compare of the secret hash.
  const provided = Buffer.from(sha256hex(clientSecret))
  const stored = Buffer.from(client.client_secret_hash)
  if (provided.length !== stored.length || !crypto.timingSafeEqual(provided, stored)) {
    return oauthError(401, 'invalid_client', 'Client authentication failed.')
  }

  // Requested scopes (optional) must be a subset of the client's scopes.
  const clientScopes: string[] = client.scopes ?? []
  const requested = (body.scope || '').trim()
  let granted = clientScopes
  if (requested) {
    const asked = requested.split(/\s+/)
    const invalid = asked.filter(s => !clientScopes.includes(s))
    if (invalid.length) {
      return oauthError(400, 'invalid_scope', `Not authorized for scope(s): ${invalid.join(', ')}.`)
    }
    granted = asked
  }

  try {
    const { token, expiresIn } = await issueAccessToken(
      admin,
      { id: client.id, operatorId: client.operator_id, scopes: granted, mode: client.mode },
      granted,
    )
    admin.from('oauth_clients').update({ last_used_at: new Date().toISOString() }).eq('id', client.id).then(() => {}, () => {})
    return NextResponse.json(
      { access_token: token, token_type: 'Bearer', expires_in: expiresIn, scope: granted.join(' ') },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    )
  } catch (e) {
    return oauthError(500, 'server_error', e instanceof Error ? e.message : 'Could not issue a token.')
  }
}
