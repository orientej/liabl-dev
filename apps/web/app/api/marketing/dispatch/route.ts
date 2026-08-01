// app/api/marketing/dispatch/route.ts
// Marketing automation — M2 campaign dispatcher. Drains the campaign_sends
// outbox, sending each pending message via Resend (email) / Twilio (SMS), then
// finalizes drained campaigns. CRON_SECRET-gated exactly like the webhook
// dispatcher; Vercel Cron invokes it (see apps/web/vercel.json). Also safe to
// POST manually with the same header.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { dispatchDueCampaignSends } from '@/lib/marketing-campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 50   // built-in stays modest; large volume goes to a 3rd party

async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const summary = await dispatchDueCampaignSends(admin, MAX_PER_RUN)
  return NextResponse.json({ ok: true, ...summary })
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
