// lib/oauth-client.ts
// Public API — operator-console OAuth client management. Client-safe (no
// crypto, no service-role): list + revoke via the authenticated browser
// client, scoped by RLS (oauth_clients_manage_own). CLIENT CREATION is NOT
// here — it generates + hashes the secret server-side (app/api/oauth/clients).
// This file never selects client_secret_hash.

import { createClient } from '@/lib/supabase'

export interface OAuthClientRecord {
  id:         string
  name:       string
  clientId:   string
  scopes:     string[]
  mode:       'live' | 'test'
  lastUsedAt: string | null
  revokedAt:  string | null
  createdAt:  string
}

export async function listOAuthClients(operatorId: string): Promise<OAuthClientRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('id, name, client_id, scopes, mode, last_used_at, revoked_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`list OAuth clients: ${error.message}`)
  return (data ?? []).map(c => ({
    id: c.id, name: c.name, clientId: c.client_id, scopes: c.scopes ?? [], mode: c.mode,
    lastUsedAt: c.last_used_at ?? null, revokedAt: c.revoked_at ?? null, createdAt: c.created_at,
  }))
}

export async function revokeOAuthClient(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('oauth_clients').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`revoke OAuth client: ${error.message}`)
}
