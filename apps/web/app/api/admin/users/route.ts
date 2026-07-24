// app/api/admin/users/route.ts
// v25 Global Admin Console — user management: list every team member
// across every operator on the platform.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()
  const { data, error } = await client
    .from('operator_members')
    .select('id, user_id, email, role, created_at, operators(id, name, slug, status)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data ?? []).map(row => {
    const operator = Array.isArray(row.operators) ? row.operators[0] : row.operators
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      role: row.role,
      joinedAt: row.created_at,
      operatorId: operator?.id ?? null,
      operatorName: operator?.name ?? 'Unknown',
      operatorSlug: operator?.slug ?? null,
      operatorStatus: operator?.status ?? null,
    }
  })

  return NextResponse.json({ users })
}
