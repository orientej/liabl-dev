// app/api/payments/quote/route.ts
// Stripe payments — S2b. A read-only price quote for a check-in: given a
// waiver id, report whether payment applies and the amount. No side effects
// (no Stripe call, no DB write) — the confirmation screen uses this to decide
// whether to show a Pay panel. Everything is derived server-side.
//
//   GET ?waiver=<id>  ->  { payable, amountCents, currency }

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured } from '@/lib/stripe'
import { resolvePayable } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const waiverId = new URL(request.url).searchParams.get('waiver')
  if (!waiverId) return NextResponse.json({ payable: false })
  if (!stripeConfigured()) return NextResponse.json({ payable: false })

  const res = await resolvePayable(createAdminClient(), waiverId)
  if (!res.ctx) return NextResponse.json({ payable: false })
  return NextResponse.json({ payable: true, amountCents: res.ctx.amountCents, currency: res.ctx.currency })
}
