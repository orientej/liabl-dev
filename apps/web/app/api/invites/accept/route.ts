// app/api/invites/accept/route.ts
// v25 M6+ team invites.
//
// GET  ?token=... — unauthenticated preview. Lets the login page show
//                   "Jim invited you to join Desert Ridge Adventures"
//                   before the person has even created an account.
// POST { token }   — actual acceptance. Requires the caller to already
//                   have an authenticated session (they signed up or
//                   logged in first) — this route only handles linking
//                   that already-authenticated user to the inviting
//                   operator, via the admin client, since normal RLS
//                   can't authorize someone who doesn't belong to the
//                   operator yet. Possession of the token is what
//                   authorizes this, the same trust model as a
//                   password-reset link.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'Missing token' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: invite, error } = await admin
    .from('operator_invites')
    .select('email, role, status, expires_at, operators(name)')
    .eq('token', token)
    .maybeSingle()

  if (error) return NextResponse.json({ valid: false, reason: error.message }, { status: 500 })
  if (!invite) return NextResponse.json({ valid: false, reason: 'Invite not found' }, { status: 404 })
  if (invite.status !== 'pending') {
    return NextResponse.json({ valid: false, reason: `This invite has already been ${invite.status}` }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'This invite has expired' }, { status: 410 })
  }

  const operator = Array.isArray(invite.operators) ? invite.operators[0] : invite.operators
  return NextResponse.json({
    valid: true,
    operatorName: operator?.name ?? 'a team',
    email: invite.email,
    role: invite.role,
  })
}

export async function POST(request: NextRequest) {
  const { token } = await request.json()
  if (!token) {
    return NextResponse.json({ joined: false, error: 'Missing token' }, { status: 400 })
  }

  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ joined: false, error: 'Sign in or create an account first' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('operator_invites')
    .select('id, operator_id, role, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteError) return NextResponse.json({ joined: false, error: inviteError.message }, { status: 500 })
  if (!invite) return NextResponse.json({ joined: false, error: 'Invite not found' }, { status: 404 })
  if (invite.status !== 'pending') {
    return NextResponse.json({ joined: false, error: `This invite has already been ${invite.status}` }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ joined: false, error: 'This invite has expired' }, { status: 410 })
  }

  // operator_members.user_id is unique — one operator per person. Give a
  // clear reason rather than letting a generic constraint-violation
  // error surface, since this is a real, expected case (see the earlier
  // conversation about no multi-org membership support).
  const { data: existingMembership } = await admin
    .from('operator_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMembership) {
    return NextResponse.json(
      { joined: false, error: 'This account already belongs to a different organization. One account can only belong to one organization at a time.' },
      { status: 409 }
    )
  }

  const { error: insertError } = await admin
    .from('operator_members')
    .insert({
      user_id: user.id,
      operator_id: invite.operator_id,
      role: invite.role,
      email: user.email,
    })

  if (insertError) {
    return NextResponse.json({ joined: false, error: insertError.message }, { status: 500 })
  }

  await admin.from('operator_invites').update({ status: 'accepted' }).eq('id', invite.id)

  return NextResponse.json({ joined: true, operatorId: invite.operator_id })
}
