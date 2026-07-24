// app/api/admin/reporting/overview/route.ts
// v25 Global Admin Console — platform-wide reporting. Every number here
// is a real aggregate query, not a placeholder — same standard as every
// other analytics surface built in this app.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: operators },
    { count: totalMembers },
    { count: totalWaivers },
    { count: waiversThisMonth },
    { data: recentWaivers },
  ] = await Promise.all([
    client.from('operators').select('id, status, plan_signature_limit'),
    client.from('operator_members').select('id', { count: 'exact', head: true }),
    client.from('waivers').select('id', { count: 'exact', head: true }).not('signed_at', 'is', null),
    client.from('waivers').select('id', { count: 'exact', head: true }).not('signed_at', 'is', null).gte('signed_at', monthStart),
    client.from('waivers').select('signed_at, operator_id').not('signed_at', 'is', null).gte('signed_at', thirtyDaysAgo),
  ])

  const activeOperators = (operators ?? []).filter(o => o.status === 'active').length
  const suspendedOperators = (operators ?? []).filter(o => o.status === 'suspended').length

  // Per-operator usage this month, to flag anyone near/over their limit
  // — reuses the same real-count approach as lib/billing.ts, just
  // across every operator instead of one.
  const monthlyCountByOperator = new Map<string, number>()
  for (const w of recentWaivers ?? []) {
    if (new Date(w.signed_at as string) >= new Date(monthStart)) {
      monthlyCountByOperator.set(w.operator_id, (monthlyCountByOperator.get(w.operator_id) ?? 0) + 1)
    }
  }
  const operatorsNearLimit = (operators ?? [])
    .map(o => ({
      operatorId: o.id,
      used: monthlyCountByOperator.get(o.id) ?? 0,
      limit: o.plan_signature_limit,
    }))
    .filter(o => o.limit > 0 && o.used / o.limit >= 0.85)

  // Simple daily trend for the last 30 days — waivers signed per day,
  // platform-wide.
  const trendByDay = new Map<string, number>()
  for (const w of recentWaivers ?? []) {
    const day = new Date(w.signed_at as string).toISOString().slice(0, 10)
    trendByDay.set(day, (trendByDay.get(day) ?? 0) + 1)
  }
  const trend = Array.from(trendByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    totalOperators: (operators ?? []).length,
    activeOperators,
    suspendedOperators,
    totalMembers: totalMembers ?? 0,
    totalWaivers: totalWaivers ?? 0,
    waiversThisMonth: waiversThisMonth ?? 0,
    operatorsNearLimit,
    trend,
  })
}
