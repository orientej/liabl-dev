// app/api/webhooks/dispatch/route.ts
// Public API v1 — Phase B webhook dispatcher. Drains the webhook_deliveries
// outbox: for every pending, due delivery it signs and POSTs the payload to
// its endpoint, then marks it succeeded or schedules an exponential-backoff
// retry (see lib/webhooks). Emission (seal write-back / member-complete)
// only writes rows; this route is what actually sends them, so delivery is
// reliable and independent of the participant's browser.
//
// Triggered by Vercel Cron on a short interval (see apps/web/vercel.json),
// protected by CRON_SECRET exactly like /api/retention: Vercel's scheduler
// sends it as a Bearer token; anyone else is rejected. Also safe to invoke
// manually with the same header (e.g. a "send now" nudge after redeliver).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { dispatchDueDeliveries } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 100

async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const summary = await dispatchDueDeliveries(admin, MAX_PER_RUN)
  return NextResponse.json({ ok: true, ...summary })
}

// Vercel Cron issues GET; POST is accepted too for manual/programmatic nudges.
export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
