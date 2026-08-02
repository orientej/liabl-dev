// lib/stripe-billing.ts
// Stripe payments — S1. SERVER-ONLY. The two write paths that touch operator
// billing state:
//   * ensureStripeCustomer() — lazily create + persist a Stripe Customer for
//     an operator (used by the checkout + portal routes).
//   * syncSubscription()     — the webhook's core: turn a Stripe subscription's
//     (status, price) into a plan_key + plan_signature_limit on the operator.
// Both use the service-role admin client; the operator is always resolved
// server-side (by id or by stripe_customer_id), never from a request body.

import { createAdminClient } from '@/lib/supabase-admin'
import { getStripe, effectivePlan } from '@/lib/stripe'

type AdminClient = ReturnType<typeof createAdminClient>

/** Return the operator's Stripe customer id, creating + saving one on first
 *  use. Idempotent per operator (a saved id is reused). */
export async function ensureStripeCustomer(
  admin: AdminClient,
  operatorId: string,
  opts: { email?: string | null } = {}
): Promise<string> {
  const { data: op, error } = await admin
    .from('operators').select('id, name, stripe_customer_id').eq('id', operatorId).maybeSingle()
  if (error) throw new Error(`load operator: ${error.message}`)
  if (!op) throw new Error('operator not found')
  if (op.stripe_customer_id) return op.stripe_customer_id

  const customer = await getStripe().customers.create({
    email: opts.email ?? undefined,
    name: op.name ?? undefined,
    metadata: { operator_id: operatorId },
  })
  const { error: upErr } = await admin
    .from('operators').update({ stripe_customer_id: customer.id }).eq('id', operatorId)
  if (upErr) throw new Error(`save customer id: ${upErr.message}`)
  return customer.id
}

/** Apply a subscription's current (status, price) to the operator identified by
 *  its Stripe customer. Sets plan_key + plan_signature_limit from the catalog
 *  (falling back to free when cancelled or the price is unrecognized). Returns
 *  the affected operator + resolved plan, or null if no operator matches. */
export async function syncSubscription(admin: AdminClient, params: {
  customerId: string
  subscriptionId?: string | null
  status?: string | null
  priceId?: string | null
}): Promise<{ operatorId: string; planKey: string; signatureLimit: number } | null> {
  const { data: op } = await admin
    .from('operators').select('id').eq('stripe_customer_id', params.customerId).maybeSingle()
  if (!op) return null

  const plan = effectivePlan(params.status, params.priceId)
  const { error } = await admin.from('operators').update({
    stripe_subscription_id:     params.subscriptionId ?? null,
    stripe_subscription_status: params.status ?? null,
    plan_key:                   plan.key,
    plan_signature_limit:       plan.signatureLimit,
  }).eq('id', op.id)
  if (error) throw new Error(`sync subscription: ${error.message}`)

  return { operatorId: op.id, planKey: plan.key, signatureLimit: plan.signatureLimit }
}
