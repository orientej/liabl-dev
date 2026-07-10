// app/api/admin/admins/[id]/route.ts
// v25 Global Admin Console — revoke admin access.
//
// Two guardrails, both preventing a lockout that would require direct
// database access to recover from:
// 1. Can't remove your own admin access through this UI.
// 2. Can't remove the last remaining admin, even someone else's.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()

  const { data: target } = await client.from('liabl_admins').select('user_id, email').eq('id', params.id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

  if (target.user_id === admin.userId) {
    return NextResponse.json({ error: "You can't remove your own admin access. Have another admin do this if needed." }, { status: 400 })
  }

  const { count } = await client.from('liabl_admins').select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last remaining admin — this would lock everyone out of the console.' }, { status: 400 })
  }

  const { error } = await client.from('liabl_admins').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: 'admin_removed',
    targetUserId: target.user_id,
    metadata: { email: target.email },
  })

  return NextResponse.json({ removed: true })
}
