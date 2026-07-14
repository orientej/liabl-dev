// app/api/admin/impersonate/end/route.ts
// v25 Global Admin Console — logs when an impersonation session ends,
// either by the admin clicking "Return to admin" or by the 30-minute
// auto-expiry firing.
//
// Unlike the start route, this does NOT gate on requireAdmin() — the
// impersonation tab's active session is the TARGET operator's session
// (sessionStorage-backed), not the admin's own, so there's no admin
// session to check in this tab. This is fine: logging an end event is
// not a privileged action (it doesn't grant access to anything), just a
// record. The worst realistic abuse is a fabricated log entry, which is
// an audit-integrity concern, not a data-access one — the actual
// sensitive step (generating the real magic-link token) already
// happened at start time, properly gated.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { adminUserId, adminEmail, targetUserId, targetOperatorId, reason, durationSeconds } = await request.json()
  if (!adminUserId || !adminEmail) {
    return NextResponse.json({ error: 'Missing admin context' }, { status: 400 })
  }

  const client = createAdminClient()
  const { error } = await client.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: 'impersonate_end',
    target_operator_id: targetOperatorId ?? null,
    target_user_id: targetUserId ?? null,
    metadata: { reason: reason ?? 'manual', durationSeconds: durationSeconds ?? null },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logged: true })
}
