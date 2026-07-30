// app/api/webhooks/route.ts
// Public API v1 — webhook endpoint CREATION (operator console,
// authenticated). The HMAC signing secret is generated server-side and
// returned exactly ONCE; only its stored copy is kept, never re-displayed.
// List / toggle / delete live in lib/webhooks-client.ts (RLS-scoped client
// calls); creation is here because it must generate the secret server-side.
//
//   POST /api/webhooks  { url, events: string[], description? }
//   -> { id, url, events, secret }   (secret shown once)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateWebhookSecret, WEBHOOK_EVENTS } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const url: string = (body.url as string | undefined)?.trim() || ''
  const description: string | null = (body.description as string | undefined)?.trim() || null
  const requestedEvents: string[] = Array.isArray(body.events) ? body.events : []

  // Only accept https URLs — webhooks carry participant data, never plain http.
  let parsed: URL | null = null
  try { parsed = new URL(url) } catch { parsed = null }
  if (!parsed || parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'A valid https:// URL is required' }, { status: 400 })
  }

  const events = requestedEvents.filter(e => (WEBHOOK_EVENTS as readonly string[]).includes(e))
  if (events.length === 0) return NextResponse.json({ error: 'Select at least one event to subscribe to' }, { status: 400 })

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

  const secret = generateWebhookSecret()

  const { data: inserted, error } = await admin
    .from('webhook_endpoints')
    .insert({
      operator_id: membership.operator_id,
      url: parsed.toString(),
      secret,
      event_types: events,
      description,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The signing secret is returned here and NEVER again.
  return NextResponse.json({ id: inserted!.id, url: parsed.toString(), events, secret })
}
