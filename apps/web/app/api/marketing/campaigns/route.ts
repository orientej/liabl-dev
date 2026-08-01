// app/api/marketing/campaigns/route.ts
// Marketing automation — M2. Create a broadcast campaign (operator console,
// authenticated). Snapshots the opted-in audience into the outbox; the cron
// dispatcher then sends it. Listing campaigns is done client-side via RLS
// (lib/marketing-client), so this route is create-only.
//
//   POST { name, channel: 'email'|'sms', subject?, body }
//   -> { campaignId, audienceCount }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createCampaign } from '@/lib/marketing-campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const channel = body.channel === 'sms' ? 'sms' : 'email'

  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const outcome = await createCampaign(admin, {
    operatorId: membership.operator_id,
    name: (body.name as string | undefined) || '',
    channel,
    subject: (body.subject as string | undefined) ?? null,
    body: (body.body as string | undefined) || '',
    createdBy: user.id,
  })
  if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: 400 })
  return NextResponse.json(outcome)
}
