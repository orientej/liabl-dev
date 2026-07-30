// app/api/keys/route.ts
// Public API v1 — API key CREATION (operator console, authenticated). The
// plaintext key is generated + hashed server-side and returned exactly
// ONCE in the response; only the hash + prefix + last4 are stored. List and
// revoke live in lib/api-keys.ts (RLS-scoped client calls); creation is
// here because it must never expose the hashing/plaintext to the browser.
//
//   POST /api/keys  { name, scopes: string[], mode?: 'live'|'test' }
//   -> { id, key, keyPrefix, last4, scopes, mode }   (key shown once)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateApiKey, API_SCOPES } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name: string = (body.name as string | undefined)?.trim() || ''
  const mode: 'live' | 'test' = body.mode === 'test' ? 'test' : 'live'
  const requestedScopes: string[] = Array.isArray(body.scopes) ? body.scopes : []

  // Optional expiry (key rotation): a positive day count sets expires_at;
  // omitted / 0 means the key never expires. The auth layer already rejects
  // an expired key, so this needs no other enforcement.
  const expiresInDays = Number(body.expiresInDays)
  const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null

  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

  // Only allow known scopes.
  const scopes = requestedScopes.filter(s => (API_SCOPES as readonly string[]).includes(s))
  if (scopes.length === 0) return NextResponse.json({ error: 'Select at least one valid scope' }, { status: 400 })

  // Authorize: caller must be a logged-in operator member.
  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members')
    .select('operator_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const { key, prefix, last4, hash } = generateApiKey(mode)

  const { data: inserted, error } = await admin
    .from('api_keys')
    .insert({
      operator_id: membership.operator_id,
      name,
      key_prefix:  prefix,
      last4,
      key_hash:    hash,
      scopes,
      mode,
      expires_at:  expiresAt,
      created_by:  user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The plaintext key is returned here and NEVER again.
  return NextResponse.json({ id: inserted!.id, key, keyPrefix: prefix, last4, scopes, mode, expiresAt })
}
