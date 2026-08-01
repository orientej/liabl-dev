// app/api/v1/reservations/route.ts
// Public API v1 — reservations collection.
//
//   POST /api/v1/reservations   (scope reservations:write)
//     Create a booking. Body:
//       { activity_key, reservation_date?, party_size?, organizer_name?,
//         organizer_email?, members?: [{full_name?, email?}], send_invites? }
//     Auto-creates a bound session, so returned links run the normal flow.
//     Returns the reservation + its check-in links (+ per-member links).
//
//   GET  /api/v1/reservations   (scope reservations:read)  — list w/ progress
//
// Every query is scoped to the operator resolved from the API KEY.

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError, apiResponse } from '@/lib/api-auth'
import { createApiReservation } from '@/lib/reservation-create'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'reservations:write')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const body = await request.json().catch(() => ({}))
    // The whole session+reservation+members+invites flow lives in the shared
    // helper, so /api/v1 and inbound connectors create bookings identically.
    const outcome = await createApiReservation(admin, {
      operatorId: ctx.operatorId,
      mode: ctx.mode,
      activityKey: (body.activity_key as string | undefined) || '',
      reservationDate: (body.reservation_date as string | undefined) || null,
      partySize: typeof body.party_size === 'number' ? body.party_size : null,
      organizerName: (body.organizer_name as string | undefined) || null,
      organizerEmail: (body.organizer_email as string | undefined) || null,
      members: Array.isArray(body.members) ? body.members : [],
      sendInvites: !!body.send_invites,
      sessionRefPrefix: 'API',
    })
    if (outcome.error) {
      await logApiRequest(admin, ctx, request, 400)
      return apiError(400, outcome.error.code, outcome.error.message)
    }

    const r = outcome.result!
    await logApiRequest(admin, ctx, request, 201)
    return apiResponse(ctx, {
      id: r.id,
      status: r.status,
      activity_key: r.activityKey,
      reservation_date: r.reservationDate,
      links: r.links,
      members: r.members,
    }, { status: 201 })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to create reservation.')
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'reservations:read')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100)
    const before = url.searchParams.get('created_before')

    let q = admin.from('reservations')
      .select('id, activity_key, reservation_date, party_size, status, created_at')
      .eq('operator_id', ctx.operatorId)
      .eq('mode', ctx.mode)   // sandbox isolation: a key only sees its own mode's data
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) q = q.lt('created_at', before)
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)

    const ids = (rows ?? []).map(r => r.id)
    const [{ data: members }, { data: signed }] = await Promise.all([
      admin.from('reservation_members').select('reservation_id').in('reservation_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      admin.from('waivers').select('reservation_id').in('reservation_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).not('signed_at', 'is', null),
    ])
    const memberCount = new Map<string, number>(); for (const m of members ?? []) memberCount.set(m.reservation_id, (memberCount.get(m.reservation_id) ?? 0) + 1)
    const signedCount = new Map<string, number>(); for (const w of signed ?? []) if (w.reservation_id) signedCount.set(w.reservation_id, (signedCount.get(w.reservation_id) ?? 0) + 1)

    const items = (rows ?? []).map(r => ({
      id: r.id, activity_key: r.activity_key, reservation_date: r.reservation_date,
      status: r.status, party_size: r.party_size,
      signed_count: signedCount.get(r.id) ?? 0,
      expected_count: Math.max(r.party_size ?? 0, memberCount.get(r.id) ?? 0),
      created_at: r.created_at,
    }))
    const nextCursor = items.length === limit ? items[items.length - 1].created_at : null

    await logApiRequest(admin, ctx, request, 200)
    return apiResponse(ctx, { items, next_cursor: nextCursor })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to list reservations.')
  }
}
