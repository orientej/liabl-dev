// app/api/admin/operators/[id]/route.ts
// v25 Global Admin Console — edit an operator, including suspend/
// reactivate. No DELETE here by design — see 018_admin_console_
// foundation.sql's comment on why hard-delete isn't part of this phase.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  const patch: Record<string, unknown> = {}
  if (body.name              !== undefined) patch.name                 = String(body.name).trim()
  if (body.governingLawState !== undefined) patch.governing_law_state  = String(body.governingLawState).trim()
  if (body.governingLawCounty !== undefined) patch.governing_law_county = body.governingLawCounty ? String(body.governingLawCounty).trim() : null
  if (body.planSignatureLimit !== undefined) patch.plan_signature_limit = Number(body.planSignatureLimit)
  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be "active" or "suspended"' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 })
  }

  const client = createAdminClient()
  const { error } = await client.from('operators').update(patch).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: body.status !== undefined
      ? (body.status === 'suspended' ? 'operator_suspended' : 'operator_reactivated')
      : 'operator_updated',
    targetOperatorId: params.id,
    metadata: patch,
  })

  return NextResponse.json({ updated: true })
}
