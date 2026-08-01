// lib/oauth.ts
// Public API — Phase D1 OAuth2 client-credentials. SERVER-ONLY (node crypto +
// service-role client). Client registration lives in the console; this file
// mints credentials and issues short-lived access tokens. The /api/v1 auth
// path (lib/api-auth) resolves those tokens alongside API keys.

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'

type AdminClient = ReturnType<typeof createAdminClient>

export const ACCESS_TOKEN_TTL_SECONDS = 3600            // 1 hour
export const ACCESS_TOKEN_PREFIX = 'liabl_at_'          // distinguishes tokens from api keys at auth time

export function sha256hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

/** A new OAuth client: the plaintext secret (shown once) + the public
 *  client_id and the stored hash. */
export function generateClientCredentials(): { clientId: string; clientSecret: string; clientSecretHash: string } {
  const clientId = `liabl_client_${crypto.randomBytes(12).toString('base64url')}`
  const clientSecret = `liabl_secret_${crypto.randomBytes(24).toString('base64url')}`
  return { clientId, clientSecret, clientSecretHash: sha256hex(clientSecret) }
}

/**
 * Issue an opaque access token for a client: inserts the hash + expiry and
 * returns the plaintext token (shown once, in the token response). The token
 * carries the granted scopes and mode so the auth path needs no join back to
 * the client on every request.
 */
export async function issueAccessToken(
  admin: AdminClient,
  client: { id: string; operatorId: string; scopes: string[]; mode: 'live' | 'test' },
  grantedScopes: string[],
): Promise<{ token: string; expiresIn: number; expiresAt: string }> {
  const token = `${ACCESS_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString()
  const { error } = await admin.from('oauth_access_tokens').insert({
    client_id:   client.id,
    operator_id: client.operatorId,
    token_hash:  sha256hex(token),
    scopes:      grantedScopes,
    mode:        client.mode,
    expires_at:  expiresAt,
  })
  if (error) throw new Error(error.message)
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS, expiresAt }
}
