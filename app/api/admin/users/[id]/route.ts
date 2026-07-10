// app/api/admin/users/[id]/route.ts
// v25 Global Admin Console — edit a member's role, or remove them from
// their operator. Removing deletes only the operator_members link, not
// their auth.users account — their login stays intact in case they need
// to be re-invited or join a different organization later, consistent
// with how lib/invites.ts's whole model treats membership as separate
// from identity.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { role } = await request.json()
  if (!['owner', 'staff'].includes(role)) {
    return NextResponse.json({ error: 'role must be "owner" or "staff"' }, { status: 400 })
  }

  const client = createAdminClient()

  const { data: existing } = await client.from('operator_members').select('operator_id, user_id').eq('id', params.id).maybeSingle()

  const { error } = await client.from('operator_members').update({ role }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: 'member_role_changed',
    targetOperatorId: existing?.operator_id ?? null,
    targetUserId: existing?.user_id ?? null,
    metadata: { newRole: role },
  })

  return NextResponse.json({ updated: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()

  const { data: existing } = await client.from('operator_members').select('operator_id, user_id, email').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { error } = await client.from('operator_members').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: 'member_removed',
    targetOperatorId: existing.operator_id,
    targetUserId: existing.user_id,
    metadata: { email: existing.email },
  })

  return NextResponse.json({ removed: true })
}
