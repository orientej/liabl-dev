// lib/payments.ts
// Stripe payments — S2b participant payments. SERVER-ONLY. Turns a completed
// check-in (a waiver) into a charge on the operator's connected account.
//
// The amount is ALWAYS derived here from the activity's configured price — the
// check-in flow is anonymous, so a browser-supplied amount is never trusted.
// The only input from the client is the waiver id (unguessable), from which we
// resolve operator, activity, price, and the operator's Connect account.
//
// Charge shape: a destination charge on the PLATFORM account with
// transfer_data.destination = the operator's connected account (funds settle to
// the operator) and an optional application_fee_amount (Liabl's platform fee,
// default 0). Test-mode check-ins never charge.

import { createAdminClient } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import { applicationFeeCents } from '@/lib/stripe-connect'
import { fetchBranding } from '@/lib/branding'
import { sendPaymentReceipt } from '@/lib/email'

type AdminClient = ReturnType<typeof createAdminClient>

const DEFAULT_CURRENCY = 'usd'
// A PaymentIntent whose secret can still be used to pay.
const OPEN_PI_STATUSES = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action'])

export interface PayableContext {
  operatorId:       string
  participantId:    string | null
  activityKey:      string | null
  amountCents:      number
  currency:         string
  connectAccountId: string
}

// { ctx } when payable, { reason } otherwise. (A plain-property shape rather
// than a boolean-discriminated union — the latter doesn't narrow through `!`.)
export interface PayableResult { ctx?: PayableContext; reason?: string }

/** Resolve whether a waiver is payable and for how much — entirely from
 *  server-side data. Not payable when: waiver missing, test-mode, no/zero
 *  activity price, or the operator's Connect account can't take charges. */
export async function resolvePayable(admin: AdminClient, waiverId: string): Promise<PayableResult> {
  const { data: waiver } = await admin
    .from('waivers').select('id, operator_id, participant_id, activity_key, mode').eq('id', waiverId).maybeSingle()
  if (!waiver) return { reason: 'waiver not found' }
  if (waiver.mode === 'test') return { reason: 'test mode' }

  const { data: activity } = await admin
    .from('activities').select('price_cents')
    .eq('operator_id', waiver.operator_id).eq('key', waiver.activity_key).maybeSingle()
  const price = activity?.price_cents
  if (!price || price <= 0) return { reason: 'no price' }

  const { data: op } = await admin
    .from('operators').select('stripe_connect_account_id, connect_charges_enabled')
    .eq('id', waiver.operator_id).maybeSingle()
  if (!op?.stripe_connect_account_id || !op.connect_charges_enabled) {
    return { reason: 'payments not enabled' }
  }

  return {
    ctx: {
      operatorId: waiver.operator_id,
      participantId: waiver.participant_id ?? null,
      activityKey: waiver.activity_key ?? null,
      amountCents: price,
      currency: DEFAULT_CURRENCY,
      connectAccountId: op.stripe_connect_account_id,
    },
  }
}

export type IntentResult =
  | { clientSecret: string; amountCents: number; currency: string }
  | { skip: true; reason: string }

/** Create (or reuse an open) PaymentIntent for a waiver and record it in
 *  `payments`. Reuse keeps a single live intent per waiver so re-opening the
 *  confirmation screen doesn't spawn duplicates. */
export async function createOrReusePaymentIntent(admin: AdminClient, waiverId: string): Promise<IntentResult> {
  const res = await resolvePayable(admin, waiverId)
  if (!res.ctx) return { skip: true, reason: res.reason ?? 'not payable' }
  const ctx = res.ctx
  const stripe = getStripe()

  // Reuse an existing open intent for this waiver, if any.
  const { data: existing } = await admin
    .from('payments').select('id, stripe_payment_intent_id, status')
    .eq('waiver_id', waiverId).eq('status', 'requires_payment')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id)
      if (pi.client_secret && OPEN_PI_STATUSES.has(pi.status)) {
        return { clientSecret: pi.client_secret, amountCents: ctx.amountCents, currency: ctx.currency }
      }
    } catch { /* fall through and create a fresh one */ }
  }

  const feeCents = applicationFeeCents(ctx.amountCents)
  const pi = await stripe.paymentIntents.create({
    amount: ctx.amountCents,
    currency: ctx.currency,
    description: 'Check-in payment',
    transfer_data: { destination: ctx.connectAccountId },
    ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
    metadata: { waiver_id: waiverId, operator_id: ctx.operatorId },
  })
  if (!pi.client_secret) return { skip: true, reason: 'no client secret' }

  await admin.from('payments').insert({
    operator_id: ctx.operatorId,
    waiver_id: waiverId,
    participant_id: ctx.participantId,
    activity_key: ctx.activityKey,
    stripe_payment_intent_id: pi.id,
    amount_cents: ctx.amountCents,
    currency: ctx.currency,
    application_fee_cents: feeCents,
    connected_account_id: ctx.connectAccountId,
    status: 'requires_payment',
    description: 'Check-in payment',
  })

  return { clientSecret: pi.client_secret, amountCents: ctx.amountCents, currency: ctx.currency }
}

/** Update a payment's status from a payment_intent webhook. */
export async function markPaymentStatus(
  admin: AdminClient,
  paymentIntentId: string,
  status: 'succeeded' | 'failed' | 'canceled' | 'refunded'
): Promise<void> {
  await admin.from('payments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntentId)
}

export type RefundResult = { ok: true } | { error: string }

/** Refund a succeeded payment. Operator-scoped: the caller must pass the
 *  operator resolved from their session, and the payment must belong to them.
 *  Reverses the transfer (pulls funds back from the connected account) and
 *  returns any application fee. The webhook also confirms via charge.refunded. */
export async function refundPayment(admin: AdminClient, paymentId: string, operatorId: string): Promise<RefundResult> {
  const { data: payment } = await admin
    .from('payments').select('id, operator_id, status, stripe_payment_intent_id').eq('id', paymentId).maybeSingle()
  if (!payment) return { error: 'Payment not found.' }
  if (payment.operator_id !== operatorId) return { error: 'Not your payment.' }
  if (payment.status !== 'succeeded') return { error: 'Only a completed payment can be refunded.' }

  try {
    await getStripe().refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reverse_transfer: true,        // pull funds back from the operator's account
      refund_application_fee: true,  // and return the platform fee (0 by default)
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Refund failed.' }
  }
  await admin.from('payments')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', paymentId)
  return { ok: true }
}

/** Send a branded receipt for a just-succeeded payment. Best-effort: resolves
 *  the payer's email, the operator's brand, and the activity label, then emails
 *  a receipt. Idempotent in practice — driven by the once-processed
 *  payment_intent.succeeded event. */
export async function sendReceiptForPaymentIntent(admin: AdminClient, paymentIntentId: string): Promise<void> {
  const { data: payment } = await admin
    .from('payments')
    .select('operator_id, participant_id, activity_key, amount_cents, currency, created_at')
    .eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
  if (!payment || !payment.participant_id) return

  const [{ data: participant }, { data: op }, branding] = await Promise.all([
    admin.from('participants').select('email, full_name').eq('id', payment.participant_id).maybeSingle(),
    admin.from('operators').select('name').eq('id', payment.operator_id).maybeSingle(),
    fetchBranding(admin, payment.operator_id),
  ])
  if (!participant?.email) return

  let activityLabel: string | null = null
  if (payment.activity_key) {
    const { data: activity } = await admin
      .from('activities').select('display_name').eq('operator_id', payment.operator_id).eq('key', payment.activity_key).maybeSingle()
    activityLabel = activity?.display_name ?? payment.activity_key
  }

  await sendPaymentReceipt({
    to: participant.email,
    participantName: participant.full_name ?? null,
    operatorName: op?.name ?? 'Us',
    amountCents: payment.amount_cents,
    currency: payment.currency ?? 'usd',
    activityLabel,
    paidAt: new Date().toISOString(),
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
  })
}
