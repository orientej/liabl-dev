// app/api/reservations/[id]/send-invites/route.ts
// Group reservations — operator-side invite sending. The organizer path is
// /api/reservations/manage (token-gated); this is the authenticated
// operator equivalent: staff trigger the personal check-in emails from the
// console. Authorization reuses the operator_members membership check (same
// as send-confirmation), then the admin client does the actual reads/sends
// (reservation_members has no public-read).
//
//   POST /api/reservations/{id}/send-invites  { memberIds?: string[], remindUnsigned?: boolean }
//   -> memberIds given: send to exactly those members.
//      remindUnsigned: (re)send to every member with an email who hasn't
//        signed yet — the "Send reminder" action scoped to the group.
//      neither: send to all members with an email not yet invited.
//      Returns how many were sent.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendReservationInviteEmail } from '@/lib/email'
import { reservationMemberCheckInUrl } from '@/lib/participant-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const reservationId = params.id
  if (!reservationId) return NextResponse.json({ error: 'Missing reservation id' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const memberIds: string[] | undefined = Array.isArray(body.memberIds) ? body.memberIds : undefined
  const remindUnsigned: boolean = body.remindUnsigned === true

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, operator_id, activity_key, reservation_date, organizer_name, status')
    .eq('id', reservationId)
    .maybeSingle()
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  if (reservation.status === 'cancelled') {
    return NextResponse.json({ error: 'This reservation has been cancelled.' }, { status: 410 })
  }

  // Authorize: caller must be a member of the reservation's operator.
  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data: membership } = await admin
    .from('operator_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('operator_id', reservation.operator_id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Not authorized for this reservation' }, { status: 403 })

  // Which members to invite.
  let query = admin.from('reservation_members')
    .select('id, email, member_token, invited_at, status')
    .eq('reservation_id', reservation.id)
    .not('email', 'is', null)
  if (memberIds && memberIds.length > 0) query = query.in('id', memberIds)
  // Reminder mode: only those who still haven't signed.
  else if (remindUnsigned) query = query.neq('status', 'signed')
  const { data: members } = await query

  const [{ data: op }, { data: activity }] = await Promise.all([
    admin.from('operators').select('name').eq('id', reservation.operator_id).maybeSingle(),
    admin.from('activities').select('display_name').eq('operator_id', reservation.operator_id).eq('key', reservation.activity_key).maybeSingle(),
  ])
  const operatorName  = op?.name ?? 'the operator'
  const activityLabel = activity?.display_name ?? reservation.activity_key

  let sent = 0
  const errors: string[] = []
  for (const m of members ?? []) {
    // Plain "invite all" skips already-invited members; a reminder
    // deliberately re-sends to everyone still unsigned.
    if (!memberIds && !remindUnsigned && m.invited_at) continue
    try {
      await sendReservationInviteEmail({
        to:              m.email as string,
        organizerName:   reservation.organizer_name || 'The organizer',
        operatorName,
        activityLabel,
        reservationDate: reservation.reservation_date,
        checkInUrl:      reservationMemberCheckInUrl(m.member_token),
      })
      await admin.from('reservation_members').update({ invited_at: new Date().toISOString() }).eq('id', m.id)
      sent++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'send failed')
    }
  }

  return NextResponse.json({ sent, errors })
}
