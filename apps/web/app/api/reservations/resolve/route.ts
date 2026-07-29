// app/api/reservations/resolve/route.ts
// Group reservations — resolves a reservation check-in entry point for the
// participant flow. reservations/reservation_members have NO public-read
// (they hold PII), so this admin-client route is the only way the
// anonymous participant flow can turn a token/id into the non-PII bits it
// needs: which operator + session + activity to run, and (for a personal
// link) which member is signing.
//
//   GET ?m={member_token}   -> personal link (returns the member)
//   GET ?r={reservation_id} -> shared/walk-up link (no member)
//
// Returns only non-sensitive routing data (operator slug, session id,
// activity key, reservation id, member id + first name) — never emails.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReservationEmbed = {
  id: string
  activity_key: string
  session_id: string | null
  status: string
  operator_id: string
  operators: { slug: string } | { slug: string }[] | null
}

function slugOf(res: ReservationEmbed | null): string | null {
  if (!res) return null
  const op = Array.isArray(res.operators) ? res.operators[0] : res.operators
  return op?.slug ?? null
}

export async function GET(request: NextRequest) {
  const memberToken   = request.nextUrl.searchParams.get('m')
  const reservationId = request.nextUrl.searchParams.get('r')
  if (!memberToken && !reservationId) {
    return NextResponse.json({ error: 'Missing member token or reservation id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const resSelect = 'id, activity_key, session_id, status, operator_id, operators(slug)'

  let reservation: ReservationEmbed | null = null
  let member: { id: string; full_name: string | null } | null = null

  if (memberToken) {
    const { data, error } = await admin
      .from('reservation_members')
      .select(`id, full_name, reservations(${resSelect})`)
      .eq('member_token', memberToken)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'This check-in link is invalid.' }, { status: 404 })
    member = { id: data.id, full_name: data.full_name }
    reservation = (Array.isArray(data.reservations) ? data.reservations[0] : data.reservations) as ReservationEmbed | null
  } else {
    const { data, error } = await admin
      .from('reservations')
      .select(resSelect)
      .eq('id', reservationId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    reservation = data as ReservationEmbed | null
  }

  if (!reservation) {
    return NextResponse.json({ error: 'This reservation could not be found.' }, { status: 404 })
  }
  if (reservation.status === 'cancelled') {
    return NextResponse.json({ error: 'This reservation has been cancelled. Please contact the organizer.' }, { status: 410 })
  }

  const operatorSlug = slugOf(reservation)
  if (!operatorSlug || !reservation.session_id) {
    // A reservation with no bound session can't run the Phase-1 check-in.
    return NextResponse.json({ error: 'This reservation is not ready for check-in yet.' }, { status: 409 })
  }

  return NextResponse.json({
    operatorSlug,
    sessionId:     reservation.session_id,
    activityKey:   reservation.activity_key,
    reservationId: reservation.id,
    member: member ? { id: member.id, firstName: (member.full_name ?? '').split(' ')[0] || null } : null,
  })
}
