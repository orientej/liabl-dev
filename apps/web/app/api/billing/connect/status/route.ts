// app/api/billing/connect/status/route.ts
// Stripe payments — S2a. Report the signed-in operator's Connect readiness,
// refreshing it from Stripe first (so a just-finished onboarding reflects
// immediately without waiting for the account.updated webhook). Operator from
// session.
//
//   GET  ->  { accountId, chargesEnabled, payoutsEnabled, onboarded }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured } from '@/lib/stripe'
import { refreshConnectStatus } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  const session = createServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const status = await refreshConnectStatus(admin, membership.operator_id)
  return NextResponse.json(status)
}
