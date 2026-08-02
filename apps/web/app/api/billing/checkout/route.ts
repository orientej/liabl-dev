// app/api/billing/checkout/route.ts
// Stripe payments — S1 (embedded subscribe). Creates a subscription for the
// signed-in operator in the "deferred" style (payment_behavior:
// default_incomplete) and returns the client secret so the browser can collect
// the card with the Payment Element — no redirect to Stripe. The subscription
// stays incomplete until the client confirms payment; the webhook then flips
// the operator to the paid plan. Plan CHANGES for an already-subscribed
// operator go through the Customer Portal (Manage billing), not here.
//
//   POST { plan: 'connected' | 'pro' }  ->  { clientSecret, subscriptionId }

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stripeConfigured, getStripe, planForKey, priceIdForPlan } from '@/lib/stripe'
import { ensureStripeCustomer } from '@/lib/stripe-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Statuses where a subscription already exists — a plan change, not a new
// signup. Sent to the Customer Portal instead of minting another subscription.
const ALREADY_SUBSCRIBED = new Set(['active', 'trialing', 'past_due'])

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const plan = planForKey(body.plan)
  if (!plan || !plan.paid) return NextResponse.json({ error: 'Unknown or non-purchasable plan.' }, { status: 400 })
  const priceId = priceIdForPlan(plan.key)
  if (!priceId) return NextResponse.json({ error: `No Stripe price configured for the ${plan.display} plan.` }, { status: 503 })

  const session = createServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members').select('operator_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const { data: op } = await admin
    .from('operators').select('stripe_subscription_status').eq('id', membership.operator_id).maybeSingle()
  if (op?.stripe_subscription_status && ALREADY_SUBSCRIBED.has(op.stripe_subscription_status)) {
    return NextResponse.json({ error: 'You already have an active subscription — use Manage billing to change plans.' }, { status: 409 })
  }

  const customerId = await ensureStripeCustomer(admin, membership.operator_id, { email: user.email })

  const subscription = await getStripe().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret'],
    metadata: { operator_id: membership.operator_id, plan_key: plan.key },
  })

  const invoice = subscription.latest_invoice as Stripe.Invoice | null
  // confirmation_secret is the current field for the invoice's payment client
  // secret; typed loosely to stay resilient across SDK/API versions.
  const clientSecret = (invoice as unknown as { confirmation_secret?: { client_secret?: string } })
    ?.confirmation_secret?.client_secret
  if (!clientSecret) {
    return NextResponse.json({ error: 'Could not initialize payment. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ clientSecret, subscriptionId: subscription.id })
}
