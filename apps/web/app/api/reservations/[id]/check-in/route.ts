// app/api/reservations/[id]/check-in/route.ts
// Group reservations — "Check in this group" (Issue 5).
//
//   POST /api/reservations/{id}/check-in
//   -> stamps checked_in_at = now() on every SIGNED waiver of this
//      reservation that isn't already checked in, marking the whole party
//      present in one action. Returns how many were newly checked in.
//
// Same authorization model as send-invites: the operator must be a member
// of the reservation's operator, verified server-side; the actual write is
// a service-role update (waivers are never written by an operator's own
// client). Idempotent — running it twice checks in only the still-pending
// signed waivers and returns 0 the second time.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const reservationId = params.id
  if (!reservationId) return NextResponse.json({ error: 'Missing reservation id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, operator_id, status')
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

  // Stamp every signed-but-not-yet-checked-in waiver for this reservation.
  const { data: updated, error } = await admin
    .from('waivers')
    .update({ checked_in_at: new Date().toISOString() })
    .eq('reservation_id', reservationId)
    .not('signed_at', 'is', null)
    .is('checked_in_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ checkedIn: updated?.length ?? 0 })
}
