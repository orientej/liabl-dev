// app/api/connectors/route.ts
// Public API — connector CREATION (operator console, authenticated). Generates
// the inbound token + signing secret server-side and returns them ONCE. List /
// toggle / delete live in lib/connectors-client.ts (RLS-scoped browser calls).
//
//   POST /api/connectors
//     { type, name, defaultActivityKey?, activityMap?, mode? }
//   -> { id, type, inboundUrl, inboundToken, signingSecret }   (secret once)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateInboundToken, generateSigningSecret } from '@/lib/connectors'
import { CONNECTOR_TYPES } from '@/lib/connectors-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const API_ORIGIN = 'https://api.liabl.ai'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name: string = (body.name as string | undefined)?.trim() || ''
  const type = String(body.type || 'generic')
  const mode: 'live' | 'test' = body.mode === 'test' ? 'test' : 'live'
  const defaultActivityKey: string | null = (body.defaultActivityKey as string | undefined)?.trim() || null

  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  if (!CONNECTOR_TYPES.some(t => t.type === type)) {
    return NextResponse.json({ error: 'Unknown connector type' }, { status: 400 })
  }

  // activityMap: accept an object of { externalId: activityKey } (optional).
  let activityMap: Record<string, string> = {}
  if (body.activityMap && typeof body.activityMap === 'object') {
    for (const [k, v] of Object.entries(body.activityMap as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) activityMap[k.trim()] = v.trim()
    }
  }

  // Authorize: a logged-in operator member.
  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const inboundToken = generateInboundToken()
  const signingSecret = generateSigningSecret()

  const { data: inserted, error } = await admin
    .from('connectors')
    .insert({
      operator_id:          membership.operator_id,
      type,
      name,
      inbound_token:        inboundToken,
      signing_secret:       signingSecret,
      default_activity_key: defaultActivityKey,
      activity_map:         activityMap,
      mode,
      created_by:           user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    id: inserted!.id,
    type,
    inboundUrl: `${API_ORIGIN}/api/connectors/${inboundToken}`,
    inboundToken,
    signingSecret,   // shown once
  })
}
