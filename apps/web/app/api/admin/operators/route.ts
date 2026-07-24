// app/api/admin/operators/route.ts
// v25 Global Admin Console — customer account management: list + create.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()

  const { data: operators, error } = await client
    .from('operators')
    .select('id, slug, name, status, governing_law_state, governing_law_county, plan_signature_limit, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary counts per operator — member count and all-time signed
  // waiver count. Done as separate grouped queries rather than a
  // per-operator loop of individual counts, since this route can list
  // every operator on the platform and N+1 queries would scale badly.
  const [{ data: memberCounts }, { data: waiverCounts }] = await Promise.all([
    client.from('operator_members').select('operator_id'),
    client.from('waivers').select('operator_id').not('signed_at', 'is', null),
  ])

  const memberCountByOperator = new Map<string, number>()
  for (const row of memberCounts ?? []) {
    memberCountByOperator.set(row.operator_id, (memberCountByOperator.get(row.operator_id) ?? 0) + 1)
  }
  const waiverCountByOperator = new Map<string, number>()
  for (const row of waiverCounts ?? []) {
    waiverCountByOperator.set(row.operator_id, (waiverCountByOperator.get(row.operator_id) ?? 0) + 1)
  }

  const result = (operators ?? []).map(op => ({
    ...op,
    memberCount: memberCountByOperator.get(op.id) ?? 0,
    waiverCount: waiverCountByOperator.get(op.id) ?? 0,
  }))

  return NextResponse.json({ operators: result })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  const { name, governingLawState, governingLawCounty, planSignatureLimit } = body
  if (!name?.trim() || !governingLawState?.trim()) {
    return NextResponse.json({ error: 'name and governingLawState are required' }, { status: 400 })
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `operator-${Date.now()}`

  const client = createAdminClient()
  const { data, error } = await client
    .from('operators')
    .insert({
      slug,
      name: name.trim(),
      governing_law_state: governingLawState.trim(),
      governing_law_county: governingLawCounty?.trim() || null,
      plan_signature_limit: planSignatureLimit ?? 500,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: 'operator_created',
    targetOperatorId: data.id,
    metadata: { name: name.trim(), slug },
  })

  return NextResponse.json({ id: data.id, slug })
}
