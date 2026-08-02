// lib/stripe.ts
// Stripe payments — S1 (operator subscriptions). SERVER-ONLY. Holds the
// configured Stripe client and the plan catalog. The secret key must never
// reach the browser (only NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY does).
//
// The plan catalog is the single source of truth mapping a Liabl plan_key to
// (a) the Stripe Price it's sold as — supplied by env so Stripe IDs are never
// hardcoded — and (b) the monthly signature limit that plan grants. The
// subscription webhook uses planForPriceId() to turn a Stripe subscription
// back into a plan_key + limit, and the checkout route uses priceIdForPlan()
// to sell it.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

/** The configured Stripe client (lazy singleton). Throws if the secret key is
 *  missing — callers in payment paths should guard with stripeConfigured(). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY).')
  if (!_stripe) _stripe = new Stripe(key)   // SDK-default pinned API version
  return _stripe
}

export type PlanKey = 'free' | 'connected' | 'pro'

export interface Plan {
  key:            PlanKey
  display:        string
  signatureLimit: number
  /** Env var holding this plan's Stripe Price id; null for the free plan
   *  (no subscription is created for free). */
  priceEnv:       string | null
  paid:           boolean
}

// Signature limits are the built-in defaults; adjust freely — the webhook
// writes whatever is here to operators.plan_signature_limit. Prices live in
// Stripe; only their ids arrive via env (never committed).
export const PLANS: Record<PlanKey, Plan> = {
  free:      { key: 'free',      display: 'Free',      signatureLimit: 50,   priceEnv: null,                     paid: false },
  connected: { key: 'connected', display: 'Connected', signatureLimit: 500,  priceEnv: 'STRIPE_PRICE_CONNECTED', paid: true  },
  pro:       { key: 'pro',       display: 'Pro',       signatureLimit: 2000, priceEnv: 'STRIPE_PRICE_PRO',       paid: true  },
}

export const DEFAULT_PLAN_KEY: PlanKey = 'free'

export function planForKey(key: string | null | undefined): Plan | null {
  if (!key) return null
  return (PLANS as Record<string, Plan>)[key] ?? null
}

/** The configured Stripe Price id for a paid plan, or null if unset/free. */
export function priceIdForPlan(key: PlanKey): string | null {
  const plan = PLANS[key]
  if (!plan?.priceEnv) return null
  return process.env[plan.priceEnv] ?? null
}

/** Reverse lookup used by the webhook: which plan a Stripe Price id sells.
 *  Matches against the env-configured price ids. */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  for (const plan of Object.values(PLANS)) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan
  }
  return null
}

// Subscription statuses under which the operator keeps their paid plan.
// past_due is included on purpose: don't yank capacity the instant a renewal
// fails — dunning (S3) handles the grace/cancel decision. canceled/unpaid/
// incomplete_expired fall through to the free plan.
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due'])

/** The plan an operator is entitled to given a subscription's status + price.
 *  An entitled status with a recognized price → that plan; anything else
 *  (cancelled, unknown price, no subscription) → the free default. */
export function effectivePlan(status: string | null | undefined, priceId: string | null | undefined): Plan {
  const entitled = !!status && ENTITLED_STATUSES.has(status)
  return (entitled ? planForPriceId(priceId) : null) ?? PLANS[DEFAULT_PLAN_KEY]
}
