// lib/stripe-connect.ts
// Stripe payments — S2 Connect (Express). SERVER-ONLY. Operators onboard their
// own Stripe account so in-person payments settle to them directly; Liabl is
// the platform. This module owns the account lifecycle: create the Express
// account, mint onboarding links, and keep the readiness flags in sync (from
// the onboarding return and the account.updated webhook). Operator is always
// resolved server-side by id or by connected-account id.

import { createAdminClient } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'

type AdminClient = ReturnType<typeof createAdminClient>

export interface ConnectStatus {
  accountId:       string | null
  chargesEnabled:  boolean
  payoutsEnabled:  boolean
  onboarded:       boolean   // charges + payouts both enabled
}

/** Application fee for a charge, in cents, from STRIPE_APPLICATION_FEE_BPS
 *  (basis points; default 0 → no platform fee). Never exceeds the amount. */
export function applicationFeeCents(amountCents: number): number {
  const bps = parseInt(process.env.STRIPE_APPLICATION_FEE_BPS || '0', 10)
  if (!Number.isFinite(bps) || bps <= 0) return 0
  return Math.min(amountCents, Math.floor((amountCents * bps) / 10000))
}

/** Return the operator's Connect account id, creating + saving an Express
 *  account on first use. Idempotent per operator. */
export async function ensureConnectAccount(
  admin: AdminClient,
  operatorId: string,
  opts: { email?: string | null } = {}
): Promise<string> {
  const { data: op, error } = await admin
    .from('operators').select('id, name, stripe_connect_account_id').eq('id', operatorId).maybeSingle()
  if (error) throw new Error(`load operator: ${error.message}`)
  if (!op) throw new Error('operator not found')
  if (op.stripe_connect_account_id) return op.stripe_connect_account_id

  const account = await getStripe().accounts.create({
    type: 'express',
    email: opts.email ?? undefined,
    business_profile: { name: op.name ?? undefined },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    metadata: { operator_id: operatorId },
  })
  const { error: upErr } = await admin
    .from('operators').update({ stripe_connect_account_id: account.id }).eq('id', operatorId)
  if (upErr) throw new Error(`save connect account: ${upErr.message}`)
  return account.id
}

/** An onboarding Account Link the operator follows to finish Stripe's hosted
 *  onboarding. Both URLs return to the console; the status refresh reconciles
 *  the result. */
export async function createOnboardingLink(accountId: string, origin: string): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/operator?connect=refresh`,
    return_url: `${origin}/operator?connect=return`,
    type: 'account_onboarding',
  })
  return link.url
}

function statusOf(accountId: string | null, charges: boolean, payouts: boolean): ConnectStatus {
  return { accountId, chargesEnabled: charges, payoutsEnabled: payouts, onboarded: charges && payouts }
}

/** Pull the live account from Stripe and persist its readiness flags. */
export async function refreshConnectStatus(admin: AdminClient, operatorId: string): Promise<ConnectStatus> {
  const { data: op } = await admin
    .from('operators').select('stripe_connect_account_id, connect_charges_enabled, connect_payouts_enabled')
    .eq('id', operatorId).maybeSingle()
  const accountId = op?.stripe_connect_account_id ?? null
  if (!accountId) return statusOf(null, false, false)

  const account = await getStripe().accounts.retrieve(accountId)
  const charges = !!account.charges_enabled
  const payouts = !!account.payouts_enabled
  await admin.from('operators')
    .update({ connect_charges_enabled: charges, connect_payouts_enabled: payouts })
    .eq('id', operatorId)
  return statusOf(accountId, charges, payouts)
}

/** Sync readiness flags from an account.updated webhook (resolve operator by
 *  connected-account id). Returns the operator id, or null if none matches. */
export async function applyAccountUpdate(
  admin: AdminClient,
  params: { accountId: string; chargesEnabled: boolean; payoutsEnabled: boolean }
): Promise<string | null> {
  const { data: op } = await admin
    .from('operators').select('id').eq('stripe_connect_account_id', params.accountId).maybeSingle()
  if (!op) return null
  await admin.from('operators')
    .update({ connect_charges_enabled: params.chargesEnabled, connect_payouts_enabled: params.payoutsEnabled })
    .eq('id', op.id)
  return op.id
}
