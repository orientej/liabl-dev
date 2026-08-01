// lib/api-keys.ts
// Public API v1 — operator-console key management. Client-safe (no crypto,
// no service-role): list and revoke use the authenticated browser client,
// scoped by RLS (api_keys_manage_own). KEY CREATION is NOT here — it must
// generate + hash the key server-side, so it lives in the route handler
// app/api/keys/route.ts. This file also never selects key_hash.

import { createClient } from '@/lib/supabase'

// The scope catalog shown in the console. Kept here (not imported from
// lib/api-auth) so this stays client-safe — api-auth is server-only.
export const API_SCOPE_OPTIONS: { scope: string; label: string }[] = [
  { scope: 'reservations:read',  label: 'Read reservations & signature status' },
  { scope: 'reservations:write', label: 'Create reservations & add attendees' },
  { scope: 'sessions:write',     label: 'Create sessions / timeslots' },
  { scope: 'waivers:read',       label: 'Read waiver status & documents' },
  { scope: 'contacts:read',      label: 'Read opted-in marketing contacts' },
  { scope: 'webhooks:manage',    label: 'Manage webhook endpoints' },
]

export interface ApiKeyRecord {
  id:         string
  name:       string
  keyPrefix:  string
  last4:      string
  scopes:     string[]
  mode:       'live' | 'test'
  lastUsedAt: string | null
  expiresAt:  string | null
  revokedAt:  string | null
  createdAt:  string
}

export async function listApiKeys(operatorId: string): Promise<ApiKeyRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last4, scopes, mode, last_used_at, expires_at, revoked_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`list API keys: ${error.message}`)
  return (data ?? []).map(k => ({
    id: k.id, name: k.name, keyPrefix: k.key_prefix, last4: k.last4,
    scopes: k.scopes ?? [], mode: k.mode,
    lastUsedAt: k.last_used_at ?? null, expiresAt: k.expires_at ?? null,
    revokedAt: k.revoked_at ?? null, createdAt: k.created_at,
  }))
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`revoke API key: ${error.message}`)
}
