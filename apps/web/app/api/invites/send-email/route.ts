// app/api/invites/send-email/route.ts
// v25 M6+ team invites — sends the actual invite email (Resend must stay
// server-only). Separate from lib/invites.ts's createInvite() the same
// way waiver signing separates the DB write from logEvent/sealing —
// small, single-purpose steps.
//
// Verifies the CALLER (via their own session) actually belongs to the
// invite's operator before sending — otherwise anyone who learned an
// arbitrary inviteId could trigger a resend to someone else's invitee,
// using this app's sending reputation. The admin client is only used
// for the actual cross-checking reads/send, not to skip that check.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendTeamInviteEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { inviteId } = await request.json()
  if (!inviteId) {
    return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 })
  }

  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('operator_invites')
    .select('email, role, token, operator_id, operators(name)')
    .eq('id', inviteId)
    .maybeSingle()

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  // The actual authorization check: does the caller belong to THIS
  // invite's operator? Not assumed just because they knew the ID.
  const { data: membership } = await admin
    .from('operator_members')
    .select('email')
    .eq('operator_id', invite.operator_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Not authorized to send this invite' }, { status: 403 })
  }

  const operator = Array.isArray(invite.operators) ? invite.operators[0] : invite.operators
  const inviteUrl = `${request.nextUrl.origin}/operator/login?invite=${invite.token}`

  try {
    await sendTeamInviteEmail({
      to:           invite.email,
      operatorName: operator?.name ?? 'your team',
      inviterName:  membership.email ?? 'A teammate',
      role:         invite.role as 'owner' | 'staff',
      inviteUrl,
    })
  } catch (sendError) {
    return NextResponse.json(
      { sent: false, error: sendError instanceof Error ? sendError.message : 'send failed' },
      { status: 502 }
    )
  }

  return NextResponse.json({ sent: true })
}
