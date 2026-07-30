// app/api/v1/reservations/[id]/members/route.ts
// Public API v1 — add attendees to a reservation (scope reservations:write),
// optionally emailing each a personal check-in link. Operator-scoped by key.
//
//   POST { members: [{ full_name?, email? }], send_invites?: boolean }
//   -> { members: [{ id, full_name, email, check_in_url }] }

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError } from '@/lib/api-auth'
import { sendReservationInviteEmail } from '@/lib/email'
import { reservationMemberCheckInUrl } from '@/lib/participant-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request, 'reservations:write')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const { data: reservation } = await admin
      .from('reservations')
      .select('id, activity_key, reservation_date, organizer_name, status')
      .eq('id', params.id).eq('operator_id', ctx.operatorId).maybeSingle()
    if (!reservation) { await logApiRequest(admin, ctx, request, 404); return apiError(404, 'not_found', 'Reservation not found.') }
    if (reservation.status === 'cancelled') { await logApiRequest(admin, ctx, request, 409); return apiError(409, 'cancelled', 'This reservation has been cancelled.') }

    const body = await request.json().catch(() => ({}))
    const memberInput: { full_name?: string; email?: string }[] = Array.isArray(body.members) ? body.members : []
    if (memberInput.length === 0) { await logApiRequest(admin, ctx, request, 400); return apiError(400, 'invalid_request', 'Provide a non-empty members array.') }

    const rows = memberInput.map(m => ({
      reservation_id: reservation.id, operator_id: ctx.operatorId,
      full_name: m.full_name?.trim() || null, email: m.email?.trim().toLowerCase() || null,
    }))
    const { data: inserted, error } = await admin.from('reservation_members').insert(rows).select('id, full_name, email, member_token')
    if (error) throw new Error(error.message)

    let op: { name: string } | null = null, act: { display_name: string } | null = null
    if (body.send_invites) {
      const [{ data: o }, { data: a }] = await Promise.all([
        admin.from('operators').select('name').eq('id', ctx.operatorId).maybeSingle(),
        admin.from('activities').select('display_name').eq('operator_id', ctx.operatorId).eq('key', reservation.activity_key).maybeSingle(),
      ])
      op = o; act = a
    }

    const members: { id: string; full_name: string | null; email: string | null; check_in_url: string }[] = []
    for (const m of inserted ?? []) {
      members.push({ id: m.id, full_name: m.full_name, email: m.email, check_in_url: reservationMemberCheckInUrl(m.member_token) })
      if (body.send_invites && m.email) {
        try {
          await sendReservationInviteEmail({
            to: m.email, organizerName: reservation.organizer_name || 'The organizer',
            operatorName: op?.name ?? 'the operator', activityLabel: act?.display_name ?? reservation.activity_key,
            reservationDate: reservation.reservation_date, checkInUrl: reservationMemberCheckInUrl(m.member_token),
          })
          await admin.from('reservation_members').update({ invited_at: new Date().toISOString() }).eq('id', m.id)
        } catch { /* best-effort */ }
      }
    }

    await logApiRequest(admin, ctx, request, 201)
    return NextResponse.json({ members }, { status: 201 })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to add members.')
  }
}
