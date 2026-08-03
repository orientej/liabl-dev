// app/api/billing/connect/onboard/route.ts
// Stripe payments — S2a. Start (or resume) Stripe Connect Express onboarding
// for the signed-in operator: ensure an Express account exists, then return a
// hosted Account Link URL for the client to redirect to. Onboarding itself is
// Stripe-hosted (identity/bank verification) — a deliberate hand-off, since
// it's a one-time setup and Stripe owns the KYC. Operator from session.
//
//   POST {}  ->  { url }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured } from '@/lib/stripe'
import { ensureConnectAccount, createOnboardingLink } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  const session = createServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const accountId = await ensureConnectAccount(admin, membership.operator_id, { email: user.email })
  const origin = process.env.NEXT_PUBLIC_OPERATOR_URL || new URL(request.url).origin
  const url = await createOnboardingLink(accountId, origin)

  return NextResponse.json({ url })
}
