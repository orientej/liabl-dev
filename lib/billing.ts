// lib/billing.ts
// v25 M5 — real per-operator signature usage against their plan limit.
// No payment processor integration — internal enforcement only, per
// scope. "Enforcement" here means accurate reporting and a clear staff
// alert, not blocking signing (soft block, by design — see
// 013_m5_billing.sql's notification copy for the same decision applied
// to the trigger-driven notification).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BillingStatus {
  used: number
  limit: number
  percentUsed: number
  periodLabel: string
}

export async function fetchBillingStatus(
  supabase: SupabaseClient,
  operatorId: string
): Promise<BillingStatus> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ count, error: countError }, { data: operator, error: opError }] = await Promise.all([
    supabase
      .from('waivers')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .not('signed_at', 'is', null)
      .gte('signed_at', periodStart),
    supabase
      .from('operators')
      .select('plan_signature_limit')
      .eq('id', operatorId)
      .single(),
  ])

  if (countError) throw new Error(`billing status count: ${countError.message}`)
  if (opError)    throw new Error(`billing status plan lookup: ${opError.message}`)

  const used  = count ?? 0
  const limit = operator?.plan_signature_limit ?? 500

  return {
    used,
    limit,
    percentUsed: limit > 0 ? Math.round((used / limit) * 100) : 0,
    periodLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
}
