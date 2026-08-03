// lib/billing-client.ts
// Stripe payments — S1 console helpers. Client-safe: NO Stripe SDK import (the
// secret key stays server-side), just a display-only plan catalog and thin
// fetch wrappers that hand off to Stripe-hosted Checkout / Customer Portal.

import { createClient } from '@/lib/supabase'

export type PlanKey = 'free' | 'connected' | 'pro'

export interface PlanDisplay {
  key:            PlanKey
  display:        string
  signatureLimit: number
  paid:           boolean
  blurb:          string
}

// Display metadata only. The authoritative price→limit mapping lives server-
// side in lib/stripe.ts; these limits are mirrored purely for the plan cards.
export const PLAN_CATALOG: PlanDisplay[] = [
  { key: 'free',      display: 'Free',      signatureLimit: 50,   paid: false, blurb: 'Get started' },
  { key: 'connected', display: 'Connected', signatureLimit: 500,  paid: true,  blurb: 'For growing operators' },
  { key: 'pro',       display: 'Pro',       signatureLimit: 2000, paid: true,  blurb: 'High volume' },
]

export function planDisplay(key: string | null | undefined): PlanDisplay {
  return PLAN_CATALOG.find(p => p.key === key) ?? PLAN_CATALOG[0]
}

/** Create a deferred subscription and return the client secret for the
 *  embedded Payment Element. No redirect — the card is collected in-app. */
export async function createSubscription(plan: 'connected' | 'pro'): Promise<string> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.clientSecret) throw new Error(json.error || 'Could not start the subscription.')
  return json.clientSecret as string
}

/** Redirect to the Stripe Customer Portal (plan changes, card updates, cancel).
 *  This is the one intentional hand-off — a rare back-office action. */
export async function openBillingPortal(): Promise<void> {
  const res = await fetch('/api/billing/portal', { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.url) throw new Error(json.error || 'Could not open billing portal.')
  window.location.href = json.url as string
}

// ── S2a: Connect (in-person payments) ──────────────────────────────────────

export interface ConnectStatus {
  accountId:      string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  onboarded:      boolean
}

/** Start/resume Connect onboarding — redirects to Stripe's hosted flow. */
export async function connectOnboard(): Promise<void> {
  const res = await fetch('/api/billing/connect/onboard', { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.url) throw new Error(json.error || 'Could not start onboarding.')
  window.location.href = json.url as string
}

export async function fetchConnectStatus(): Promise<ConnectStatus> {
  const res = await fetch('/api/billing/connect/status')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Could not load payment status.')
  return json as ConnectStatus
}

export interface OperatorBilling {
  planKey: string
  hasCustomer: boolean
  connect: ConnectStatus
}

export async function fetchOperatorBilling(operatorId: string): Promise<OperatorBilling> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('operators')
    .select('plan_key, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled, connect_payouts_enabled')
    .eq('id', operatorId).maybeSingle()
  if (error) throw new Error(`load billing: ${error.message}`)
  const charges = !!data?.connect_charges_enabled
  const payouts = !!data?.connect_payouts_enabled
  return {
    planKey: data?.plan_key ?? 'free',
    hasCustomer: !!data?.stripe_customer_id,
    connect: {
      accountId: data?.stripe_connect_account_id ?? null,
      chargesEnabled: charges,
      payoutsEnabled: payouts,
      onboarded: charges && payouts,
    },
  }
}

// ── S2c: in-person payments list ───────────────────────────────────────────

export interface PaymentRecord {
  id:              string
  amountCents:     number
  currency:        string
  status:          string
  activityKey:     string | null
  participantName: string | null
  createdAt:       string
}

export interface PaymentsView {
  payments:         PaymentRecord[]
  collectedCents:   number   // sum of succeeded payments
  succeededCount:   number
}

/** The operator's recent check-in payments (RLS-scoped) + simple totals. */
export async function fetchPayments(operatorId: string, limit = 100): Promise<PaymentsView> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount_cents, currency, status, activity_key, created_at, participants(full_name)')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`load payments: ${error.message}`)
  const payments: PaymentRecord[] = (data ?? []).map((p: any) => ({
    id: p.id,
    amountCents: p.amount_cents,
    currency: p.currency ?? 'usd',
    status: p.status,
    activityKey: p.activity_key ?? null,
    participantName: (Array.isArray(p.participants) ? p.participants[0] : p.participants)?.full_name ?? null,
    createdAt: p.created_at,
  }))
  const succeeded = payments.filter(p => p.status === 'succeeded')
  return {
    payments,
    collectedCents: succeeded.reduce((sum, p) => sum + p.amountCents, 0),
    succeededCount: succeeded.length,
  }
}
