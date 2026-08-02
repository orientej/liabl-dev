// app/api/billing/portal/route.ts
// Stripe payments — S1. Open the Stripe Customer Portal for the signed-in
// operator so they can update their card, change plan, or cancel — all managed
// by Stripe, no billing UI to build. Requires an existing Stripe customer
// (created the first time they checked out). Operator resolved from session.
//
//   POST {}  ->  { url }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured, getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  const session = createServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const { data: op } = await admin
    .from('operators').select('stripe_customer_id').eq('id', membership.operator_id).maybeSingle()
  if (!op?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet — subscribe to a plan first.' }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_OPERATOR_URL || new URL(request.url).origin
  const portal = await getStripe().billingPortal.sessions.create({
    customer: op.stripe_customer_id,
    return_url: `${origin}/operator`,
  })

  return NextResponse.json({ url: portal.url })
}
