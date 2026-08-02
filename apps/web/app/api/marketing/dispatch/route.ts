// app/api/marketing/dispatch/route.ts
// Marketing automation — M2/M3 dispatcher. One cron drives all of built-in
// marketing sending:
//   1. broadcasts (M2)  — drain the campaign_sends outbox.
//   2. automations (M3) — evaluate active automations (enqueue anything newly
//      due), then drain the automation_sends outbox.
// Each message goes out via Resend (email) / Twilio (SMS). CRON_SECRET-gated
// exactly like the webhook dispatcher; Vercel Cron invokes it (see
// apps/web/vercel.json). Also safe to POST manually with the same header.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { dispatchDueCampaignSends } from '@/lib/marketing-campaigns'
import { evaluateAutomations, dispatchDueAutomationSends } from '@/lib/marketing-automations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 50   // built-in stays modest; large volume goes to a 3rd party

async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const campaigns = await dispatchDueCampaignSends(admin, MAX_PER_RUN)
  const evaluated = await evaluateAutomations(admin)
  const automations = await dispatchDueAutomationSends(admin, MAX_PER_RUN)
  return NextResponse.json({ ok: true, campaigns, automations: { ...evaluated, ...automations } })
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
