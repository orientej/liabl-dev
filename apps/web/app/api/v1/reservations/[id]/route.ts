// app/api/v1/reservations/[id]/route.ts
// Public API v1 — a single reservation's status (scope reservations:read).
// The booking engine polls this to learn who has signed. Scoped to the
// operator resolved from the API key: a reservation belonging to another
// operator returns 404, never its data.

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request, 'reservations:read')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const { data: reservation } = await admin
      .from('reservations')
      .select('id, activity_key, reservation_date, party_size, organizer_name, organizer_email, status, created_at')
      .eq('id', params.id)
      .eq('operator_id', ctx.operatorId)   // operator scoping — never trust the path alone
      .maybeSingle()
    if (!reservation) { await logApiRequest(admin, ctx, request, 404); return apiError(404, 'not_found', 'Reservation not found.') }

    const [{ data: members }, { count: signedCount }] = await Promise.all([
      admin.from('reservation_members')
        .select('id, full_name, email, status, invited_at, waiver_id')
        .eq('reservation_id', reservation.id).order('created_at'),
      admin.from('waivers').select('id', { count: 'exact', head: true })
        .eq('reservation_id', reservation.id).not('signed_at', 'is', null),
    ])

    const memberList = (members ?? []).map(m => ({
      id: m.id, full_name: m.full_name, email: m.email, status: m.status,
      invited_at: m.invited_at, waiver_id: m.waiver_id,
    }))
    const expected = Math.max(reservation.party_size ?? 0, memberList.length)

    await logApiRequest(admin, ctx, request, 200)
    return NextResponse.json({
      id: reservation.id,
      status: reservation.status,
      activity_key: reservation.activity_key,
      reservation_date: reservation.reservation_date,
      party_size: reservation.party_size,
      organizer_name: reservation.organizer_name,
      organizer_email: reservation.organizer_email,
      signed_count: signedCount ?? 0,
      expected_count: expected,
      members: memberList,
      created_at: reservation.created_at,
    })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to load reservation.')
  }
}
