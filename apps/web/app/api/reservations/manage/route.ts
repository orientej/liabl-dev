// app/api/reservations/manage/route.ts
// Group reservations — organizer self-service, gated by the reservation's
// self_service_token (possession = capability, the operator_invites trust
// model). This is how the person who created/owns the booking manages
// their party WITHOUT an operator login: view members + progress, add
// attendees, remove them, and send each a personal check-in link so they
// complete their waiver before the event.
//
// Admin client throughout, because the caller is unauthenticated and
// reservation_members has no public-read policy. Every query is scoped to
// the one reservation the token belongs to — the token never exposes any
// other reservation or operator.
//
//   GET  ?token={self_service_token}          -> reservation + members + progress
//   POST { token, action, ... }               -> add_member | remove_member | send_invite

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendReservationInviteEmail } from '@/lib/email'
import { reservationMemberCheckInUrl } from '@/lib/participant-url'
import { fetchBranding } from '@/lib/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Reservation = {
  id: string; operator_id: string; activity_key: string
  reservation_date: string | null; party_size: number | null
  organizer_name: string | null; organizer_email: string | null; status: string
}

async function loadReservationByToken(admin: ReturnType<typeof createAdminClient>, token: string): Promise<Reservation | null> {
  const { data } = await admin
    .from('reservations')
    .select('id, operator_id, activity_key, reservation_date, party_size, organizer_name, organizer_email, status')
    .eq('self_service_token', token)
    .maybeSingle()
  return (data as Reservation | null) ?? null
}

async function operatorName(admin: ReturnType<typeof createAdminClient>, operatorId: string): Promise<string> {
  const { data } = await admin.from('operators').select('name').eq('id', operatorId).maybeSingle()
  return data?.name ?? 'the operator'
}
async function activityLabel(admin: ReturnType<typeof createAdminClient>, operatorId: string, activityKey: string): Promise<string> {
  const { data } = await admin.from('activities').select('display_name').eq('operator_id', operatorId).eq('key', activityKey).maybeSingle()
  return data?.display_name ?? activityKey
}

async function sendInviteToMember(
  admin: ReturnType<typeof createAdminClient>,
  reservation: Reservation,
  member: { id: string; email: string | null; member_token: string },
): Promise<void> {
  if (!member.email) throw new Error('This attendee has no email address.')
  await sendReservationInviteEmail({
    to:              member.email,
    organizerName:   reservation.organizer_name || 'The organizer',
    operatorName:    await operatorName(admin, reservation.operator_id),
    activityLabel:   await activityLabel(admin, reservation.operator_id, reservation.activity_key),
    reservationDate: reservation.reservation_date,
    checkInUrl:      reservationMemberCheckInUrl(member.member_token),
  })
  await admin.from('reservation_members').update({ invited_at: new Date().toISOString() }).eq('id', member.id)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()
  const reservation = await loadReservationByToken(admin, token)
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

  const [{ data: members }, { count: signedCount }] = await Promise.all([
    admin.from('reservation_members')
      .select('id, full_name, email, member_token, status, invited_at')
      .eq('reservation_id', reservation.id)
      .order('created_at'),
    admin.from('waivers')
      .select('id', { count: 'exact', head: true })
      .eq('reservation_id', reservation.id)
      .not('signed_at', 'is', null),
  ])

  const memberList = (members ?? []).map(m => ({
    id: m.id, fullName: m.full_name, email: m.email, status: m.status, invitedAt: m.invited_at,
    checkInUrl: reservationMemberCheckInUrl(m.member_token),
  }))
  const expectedCount = Math.max(reservation.party_size ?? 0, memberList.length)
  const branding = await fetchBranding(admin, reservation.operator_id)

  return NextResponse.json({
    reservation: {
      activityKey:     reservation.activity_key,
      activityLabel:   await activityLabel(admin, reservation.operator_id, reservation.activity_key),
      operatorName:    await operatorName(admin, reservation.operator_id),
      reservationDate: reservation.reservation_date,
      partySize:       reservation.party_size,
      organizerName:   reservation.organizer_name,
      status:          reservation.status,
    },
    members: memberList,
    signedCount: signedCount ?? 0,
    expectedCount,
    branding,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { token, action } = body as { token?: string; action?: string }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()
  const reservation = await loadReservationByToken(admin, token)
  if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  if (reservation.status === 'cancelled') {
    return NextResponse.json({ error: 'This reservation has been cancelled.' }, { status: 410 })
  }

  try {
    if (action === 'add_member') {
      const fullName = (body.fullName as string | undefined)?.trim() || null
      const email    = (body.email as string | undefined)?.trim().toLowerCase() || null
      const { data: member, error } = await admin
        .from('reservation_members')
        .insert({ reservation_id: reservation.id, operator_id: reservation.operator_id, full_name: fullName, email })
        .select('id, email, member_token')
        .single()
      if (error) throw new Error(error.message)
      // Optionally send the invite immediately.
      if (body.sendInvite && member?.email) {
        await sendInviteToMember(admin, reservation, member)
      }
      return NextResponse.json({ ok: true, memberId: member!.id })
    }

    if (action === 'remove_member') {
      const memberId = body.memberId as string
      if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })
      const { error } = await admin.from('reservation_members').delete()
        .eq('id', memberId).eq('reservation_id', reservation.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === 'send_invite') {
      const memberId = body.memberId as string
      if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })
      const { data: member } = await admin
        .from('reservation_members')
        .select('id, email, member_token')
        .eq('id', memberId).eq('reservation_id', reservation.id)
        .maybeSingle()
      if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      await sendInviteToMember(admin, reservation, member)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Request failed' }, { status: 500 })
  }
}
