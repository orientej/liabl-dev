// app/api/admin/settings/[key]/route.ts
// v25 Global Admin Console — update a single platform setting.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { key: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { value } = await request.json()
  if (value === undefined) {
    return NextResponse.json({ error: 'Missing value' }, { status: 400 })
  }

  const client = createAdminClient()
  const { data: before } = await client.from('platform_settings').select('value').eq('key', params.key).maybeSingle()

  const { error } = await client
    .from('platform_settings')
    .update({ value, updated_by: admin.userId, updated_at: new Date().toISOString() })
    .eq('key', params.key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, {
    actionType: 'setting_changed',
    metadata: { key: params.key, from: before?.value ?? null, to: value },
  })

  return NextResponse.json({ updated: true })
}
