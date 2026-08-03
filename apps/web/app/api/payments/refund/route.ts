// app/api/payments/refund/route.ts
// Stripe payments — S3. Operator-initiated refund of a check-in payment.
// Authenticated: the operator is resolved from the session and the payment must
// belong to them. The refund reverses the transfer (funds come back from the
// operator's connected account) and returns any platform fee.
//
//   POST { paymentId }  ->  { ok: true }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured } from '@/lib/stripe'
import { refundPayment } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : null
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const session = createServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const result = await refundPayment(admin, paymentId, membership.operator_id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
