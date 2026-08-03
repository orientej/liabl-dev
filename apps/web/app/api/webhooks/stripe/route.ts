// app/api/webhooks/stripe/route.ts
// Stripe payments — S1. Inbound Stripe webhook. Verifies the signature against
// the raw body (STRIPE_WEBHOOK_SECRET) before doing anything, is idempotent via
// the stripe_events ledger (Stripe delivers at-least-once), and syncs the
// operator's plan whenever a subscription changes. Public URL, but only Stripe
// (which holds the signing secret) can produce a valid signature.
//
// Register this URL in the Stripe dashboard and subscribe it to:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured, getStripe } from '@/lib/stripe'
import { syncSubscription, notifyPastDue } from '@/lib/stripe-billing'
import { applyAccountUpdate } from '@/lib/stripe-connect'
import { markPaymentStatus, sendReceiptForPaymentIntent } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function priceIdOf(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeConfigured() || !secret) {
    return NextResponse.json({ error: 'Billing webhook not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const sig = request.headers.get('stripe-signature')
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig ?? '', secret)
  } catch (e) {
    return NextResponse.json({ error: `Signature verification failed: ${e instanceof Error ? e.message : 'bad signature'}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: record the event id first; a duplicate delivery collides on
  // the primary key and we acknowledge without re-processing.
  const { error: ledgerErr } = await admin
    .from('stripe_events').insert({ event_id: event.id, type: event.type })
  if (ledgerErr) {
    // 23505 = unique_violation → already processed. Any other error: surface a
    // 500 so Stripe retries rather than silently dropping the event.
    if ((ledgerErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    return NextResponse.json({ error: 'ledger write failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null
        const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id ?? null
        if (customerId && subId) {
          const sub = await getStripe().subscriptions.retrieve(subId)
          await syncSubscription(admin, { customerId, subscriptionId: sub.id, status: sub.status, priceId: priceIdOf(sub) })
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
        // A deleted subscription reports its last status; syncSubscription maps
        // any non-entitled status back to the free plan.
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status
        if (customerId) {
          await syncSubscription(admin, { customerId, subscriptionId: sub.id, status, priceId: priceIdOf(sub) })
        }
        break
      }
      case 'invoice.payment_failed': {
        // S3 dunning: notify the operator to update their card. The plan stays
        // active during past_due (grace) — this is a nudge, not an interruption.
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        if (customerId) await notifyPastDue(admin, customerId)
        break
      }
      case 'account.updated': {
        // S2a: an operator's Connect account changed readiness (finished
        // onboarding, verification cleared/failed). Mirror the capability flags.
        const acct = event.data.object as Stripe.Account
        await applyAccountUpdate(admin, {
          accountId: acct.id,
          chargesEnabled: !!acct.charges_enabled,
          payoutsEnabled: !!acct.payouts_enabled,
        })
        break
      }
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        // S2b: in-person participant payment reached a terminal state. Reflect
        // it on the payments row (keyed by the PaymentIntent id).
        const pi = event.data.object as Stripe.PaymentIntent
        const status = event.type === 'payment_intent.succeeded' ? 'succeeded'
          : event.type === 'payment_intent.canceled' ? 'canceled' : 'failed'
        await markPaymentStatus(admin, pi.id, status)
        // S3: branded receipt on success (best-effort — never fail the webhook).
        if (event.type === 'payment_intent.succeeded') {
          try { await sendReceiptForPaymentIntent(admin, pi.id) } catch { /* logged upstream */ }
        }
        break
      }
      case 'charge.refunded': {
        // S3: a payment was refunded (from the console or the Stripe dashboard).
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null
        if (piId) await markPaymentStatus(admin, piId, 'refunded')
        break
      }
      default:
        break
    }
  } catch (e) {
    // Processing failed after we ledgered the event — remove the ledger row so
    // Stripe's retry can reprocess it, then signal a retry.
    await admin.from('stripe_events').delete().eq('event_id', event.id)
    return NextResponse.json({ error: `handler error: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
