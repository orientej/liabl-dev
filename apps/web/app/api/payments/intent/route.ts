// app/api/payments/intent/route.ts
// Stripe payments — S2b. Create (or reuse) the PaymentIntent for a check-in and
// return its client secret for the embedded Payment Element. Service-role: the
// participant flow is anonymous, so this route derives the operator + amount
// server-side from the waiver id and writes the `payments` row itself (the anon
// client can't). The only input is the waiver id.
//
//   POST { waiverId }  ->  { clientSecret, amountCents, currency }  |  { skip: true }

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured } from '@/lib/stripe'
import { createOrReusePaymentIntent } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ skip: true }, { status: 200 })

  const body = await request.json().catch(() => ({}))
  const waiverId = typeof body.waiverId === 'string' ? body.waiverId : null
  if (!waiverId) return NextResponse.json({ error: 'waiverId required' }, { status: 400 })

  const result = await createOrReusePaymentIntent(createAdminClient(), waiverId)
  return NextResponse.json(result)
}
