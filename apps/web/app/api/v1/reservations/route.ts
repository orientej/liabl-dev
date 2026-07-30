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
import { authenticateApiRequest, logApiRequest, apiError } from '@/lib/api-auth'
import { sendReservationInviteEmail } from '@/lib/email'
import {
  reservationSelfServiceUrl, reservationCheckInUrl, reservationGroupCheckInUrl, reservationMemberCheckInUrl,
} from '@/lib/participant-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'reservations:write')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const body = await request.json().catch(() => ({}))
    const activityKey: string = (body.activity_key as string | undefined)?.trim() || ''
    if (!activityKey) { await logApiRequest(admin, ctx, request, 400); return apiError(400, 'invalid_request', 'activity_key is required.') }

    // Validate the activity belongs to this operator.
    const { data: activity } = await admin
      .from('activities').select('id').eq('operator_id', ctx.operatorId).eq('key', activityKey).maybeSingle()
    if (!activity) { await logApiRequest(admin, ctx, request, 400); return apiError(400, 'unknown_activity', `No activity "${activityKey}" for this operator.`) }

    const reservationDate: string = (body.reservation_date as string | undefined) || todayISO()
    const organizerName: string | null = (body.organizer_name as string | undefined)?.trim() || null

    // Auto-create a bound session (reuses the whole check-in machinery).
    const { data: session, error: sErr } = await admin
      .from('sessions')
      .insert({ operator_id: ctx.operatorId, session_ref: `API: ${organizerName || 'Reservation'}`, session_time: null, session_date: reservationDate, activity_key: activityKey })
      .select('id').single()
    if (sErr) throw new Error(`session: ${sErr.message}`)

    const { data: reservation, error: rErr } = await admin
      .from('reservations')
      .insert({
        operator_id: ctx.operatorId,
        activity_key: activityKey,
        session_id: session!.id,
        reservation_date: reservationDate,
        party_size: typeof body.party_size === 'number' ? body.party_size : null,
        organizer_name: organizerName,
        organizer_email: (body.organizer_email as string | undefined)?.trim().toLowerCase() || null,
      })
      .select('id, self_service_token, status')
      .single()
    if (rErr) throw new Error(`reservation: ${rErr.message}`)

    // Optional attendees.
    const memberInput: { full_name?: string; email?: string }[] = Array.isArray(body.members) ? body.members : []
    const createdMembers: { id: string; full_name: string | null; email: string | null; check_in_url: string }[] = []
    if (memberInput.length > 0) {
      const rows = memberInput.map(m => ({
        reservation_id: reservation!.id, operator_id: ctx.operatorId,
        full_name: m.full_name?.trim() || null, email: m.email?.trim().toLowerCase() || null,
      }))
      const { data: inserted } = await admin.from('reservation_members').insert(rows).select('id, full_name, email, member_token')
      for (const m of inserted ?? []) {
        createdMembers.push({ id: m.id, full_name: m.full_name, email: m.email, check_in_url: reservationMemberCheckInUrl(m.member_token) })
        if (body.send_invites && m.email) {
          try {
            const [{ data: op }, { data: act }] = await Promise.all([
              admin.from('operators').select('name').eq('id', ctx.operatorId).maybeSingle(),
              admin.from('activities').select('display_name').eq('operator_id', ctx.operatorId).eq('key', activityKey).maybeSingle(),
            ])
            await sendReservationInviteEmail({
              to: m.email, organizerName: organizerName || 'The organizer',
              operatorName: op?.name ?? 'the operator', activityLabel: act?.display_name ?? activityKey,
              reservationDate, checkInUrl: reservationMemberCheckInUrl(m.member_token),
            })
            await admin.from('reservation_members').update({ invited_at: new Date().toISOString() }).eq('id', m.id)
          } catch { /* invite email best-effort */ }
        }
      }
    }

    await logApiRequest(admin, ctx, request, 201)
    return NextResponse.json({
      id: reservation!.id,
      status: reservation!.status,
      activity_key: activityKey,
      reservation_date: reservationDate,
      links: {
        self_service: reservationSelfServiceUrl(reservation!.self_service_token),
        shared_check_in: reservationCheckInUrl(reservation!.id),
        group_leader: reservationGroupCheckInUrl(reservation!.id),
      },
      members: createdMembers,
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
    return NextResponse.json({ items, next_cursor: nextCursor })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to list reservations.')
  }
}
