// app/api/admin/users/[id]/mfa/route.ts
// v25 Global Admin Console — clear a user's multi-factor authentication.
//
// The support case this exists for: a user has lost their authenticator
// (phone wiped, app not backed up) and, because MFA is required for every
// operator user, can no longer sign in. An admin resets them here; the
// user's next sign-in then forces a fresh enrollment.
//
// SECURITY:
//   * requireAdmin() gates the route (defense-in-depth over middleware).
//   * The target user is resolved from the operator_members row id in the
//     path, never from a caller-supplied user id.
//   * Uses the GoTrue ADMIN mfa API (service role) — deleting a verified
//     factor also revokes the user's active sessions, so a half-open
//     session can't linger at aal2 after the reset.
//   * Also purges the user's trusted_devices ("remember this device")
//     rows, so a previously-remembered browser can't slip past the
//     re-enrollment we're forcing. Best-effort: a missing table (migration
//     039 not yet run) must not fail the primary MFA clear.
//   * Audit-logged like every other admin mutation.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()

  const { data: member } = await client
    .from('operator_members')
    .select('operator_id, user_id, email')
    .eq('id', params.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const userId = member.user_id as string

  // Enumerate then delete every enrolled factor (verified or not).
  const { data: list, error: listErr } = await client.auth.admin.mfa.listFactors({ userId })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const factors = list?.factors ?? []
  for (const f of factors) {
    const { error: delErr } = await client.auth.admin.mfa.deleteFactor({ id: f.id, userId })
    if (delErr) return NextResponse.json({ error: `Failed to delete a factor: ${delErr.message}` }, { status: 500 })
  }

  // Purge remembered devices so re-enrollment can't be skipped. Non-fatal.
  let trustedDevicesCleared = false
  try {
    const { error: tdErr } = await client.from('trusted_devices').delete().eq('user_id', userId)
    trustedDevicesCleared = !tdErr
  } catch {
    /* table may not exist yet — ignore */
  }

  await logAdminAction(admin, {
    actionType: 'user_mfa_cleared',
    targetOperatorId: member.operator_id,
    targetUserId: userId,
    metadata: { email: member.email, factorsCleared: factors.length, trustedDevicesCleared },
  })

  return NextResponse.json({ cleared: true, factorsCleared: factors.length })
}
