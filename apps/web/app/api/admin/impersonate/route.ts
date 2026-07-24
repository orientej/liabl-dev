// app/api/admin/impersonate/route.ts
// v25 Global Admin Console — impersonation, phase 2.
//
// Generates a one-time magic-link token for the target operator user via
// Supabase's admin API. The client exchanges this token in a NEW BROWSER
// TAB, using a session-storage-backed Supabase client (see lib/
// supabase.ts) rather than the normal cookie-based one — cookies are
// shared across every tab in a browser, so writing the impersonated
// session there would risk contaminating the admin's own login in their
// original tab. sessionStorage is genuinely per-tab, so the two
// identities never touch.
//
// Deliberately blocks impersonating another liabl_admin — this feature
// is for support staff to see what an operator customer sees, not for
// admin-on-admin impersonation, which is a different (and more
// sensitive) capability nobody asked for.
//
// No reason required before impersonating and no time limit on the
// token itself (the session's own 30-minute auto-expiry, enforced
// client-side, is the actual limit) — both explicit decisions made
// before this was scoped.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })

  const client = createAdminClient()

  const { data: member, error: memberError } = await client
    .from('operator_members')
    .select('user_id, email, role, operator_id, operators(name)')
    .eq('id', memberId)
    .maybeSingle()

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  if (!member || !member.email) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Block impersonating another admin — this table is checked
  // regardless of whether the target also happens to be an operator
  // member, since one person can be both.
  const { data: targetIsAdmin } = await client
    .from('liabl_admins')
    .select('id')
    .eq('user_id', member.user_id)
    .maybeSingle()
  if (targetIsAdmin) {
    return NextResponse.json({ error: 'Cannot impersonate another admin account' }, { status: 403 })
  }

  const { data: linkData, error: linkError } = await client.auth.admin.generateLink({
    type: 'magiclink',
    email: member.email,
  })
  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate impersonation link' }, { status: 500 })
  }

  const operator = Array.isArray(member.operators) ? member.operators[0] : member.operators

  await logAdminAction(admin, {
    actionType: 'impersonate_start',
    targetOperatorId: member.operator_id,
    targetUserId: member.user_id,
    metadata: { email: member.email, role: member.role, operatorName: operator?.name ?? 'Unknown' },
  })

  return NextResponse.json({
    tokenHash: linkData.properties.hashed_token,
    targetEmail: member.email,
    operatorName: operator?.name ?? 'Unknown',
  })
}
