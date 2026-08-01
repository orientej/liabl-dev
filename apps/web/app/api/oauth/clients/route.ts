// app/api/oauth/clients/route.ts
// Public API — OAuth client CREATION (operator console, authenticated). The
// client_secret is generated + hashed server-side and returned exactly ONCE;
// only the hash + public client_id are stored. List/revoke live in
// lib/oauth-client.ts (RLS-scoped browser calls).
//
//   POST /api/oauth/clients  { name, scopes: string[], mode?: 'live'|'test' }
//   -> { id, clientId, clientSecret, scopes, mode }   (secret shown once)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateClientCredentials } from '@/lib/oauth'
import { API_SCOPES } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name: string = (body.name as string | undefined)?.trim() || ''
  const mode: 'live' | 'test' = body.mode === 'test' ? 'test' : 'live'
  const requestedScopes: string[] = Array.isArray(body.scopes) ? body.scopes : []

  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

  const scopes = requestedScopes.filter(s => (API_SCOPES as readonly string[]).includes(s))
  if (scopes.length === 0) return NextResponse.json({ error: 'Select at least one valid scope' }, { status: 400 })

  // Authorize: a logged-in operator member.
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

  const { clientId, clientSecret, clientSecretHash } = generateClientCredentials()

  const { data: inserted, error } = await admin
    .from('oauth_clients')
    .insert({
      operator_id:        membership.operator_id,
      name,
      client_id:          clientId,
      client_secret_hash: clientSecretHash,
      scopes,
      mode,
      created_by:         user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The secret is returned here and NEVER again.
  return NextResponse.json({ id: inserted!.id, clientId, clientSecret, scopes, mode })
}
