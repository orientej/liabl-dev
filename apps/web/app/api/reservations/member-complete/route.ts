// app/api/reservations/member-complete/route.ts
// Group reservations — links a just-signed check-in back to its reservation
// member and advances reservation progress. Called (fire-and-forget) at the
// end of a reservation check-in, after the waiver is signed.
//
// Service-role: reservation_members has no anon policy, so the anonymous
// participant can't flip a member to 'signed' or set its waiver_id
// directly. This narrow route does exactly that — bind member -> waiver,
// mark 'signed', and mark the reservation 'complete' once everyone expected
// has signed. Same service-role pattern as the seal-writeback routes.
//
//   POST { waiverId, memberToken?, reservationId? }

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { emitWebhookEvent } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { waiverId, memberToken } = body as { waiverId?: string; memberToken?: string; reservationId?: string }
  let reservationId = body.reservationId as string | undefined
  if (!waiverId) return NextResponse.json({ error: 'Missing waiverId' }, { status: 400 })

  const admin = createAdminClient()

  // Track a member we newly flip to 'signed', so we can emit
  // reservation.member_signed once we know the operator.
  let signedMember: { id: string; full_name: string | null; email: string | null } | null = null

  // Personal-link check-in: bind the member to this waiver and mark signed.
  if (memberToken) {
    const { data: member } = await admin
      .from('reservation_members')
      .select('id, reservation_id, waiver_id, full_name, email')
      .eq('member_token', memberToken)
      .maybeSingle()
    if (member) {
      reservationId = member.reservation_id
      if (!member.waiver_id) {
        await admin.from('reservation_members')
          .update({ waiver_id: waiverId, status: 'signed' })
          .eq('id', member.id)
        signedMember = { id: member.id, full_name: member.full_name, email: member.email }
      }
      await admin.from('waivers')
        .update({ reservation_member_id: member.id, reservation_id: member.reservation_id })
        .eq('id', waiverId)
    }
  }

  if (!reservationId) return NextResponse.json({ ok: true, note: 'no reservation to update' })

  // Advance reservation status to 'complete' once signed >= expected.
  const [{ data: reservation }, { data: members }, { count: signedCount }] = await Promise.all([
    admin.from('reservations').select('id, operator_id, activity_key, party_size, status').eq('id', reservationId).maybeSingle(),
    admin.from('reservation_members').select('id', { count: 'exact', head: false }).eq('reservation_id', reservationId),
    admin.from('waivers').select('id', { count: 'exact', head: true })
      .eq('reservation_id', reservationId).not('signed_at', 'is', null),
  ])

  const expected = reservation ? Math.max(reservation.party_size ?? 0, (members ?? []).length) : 0

  // An attendee just checked in — emit member_signed (best-effort).
  if (reservation?.operator_id && signedMember) {
    await emitWebhookEvent(admin, {
      operatorId: reservation.operator_id,
      eventType: 'reservation.member_signed',
      data: {
        reservation_id: reservation.id,
        activity_key: reservation.activity_key,
        member_id: signedMember.id,
        full_name: signedMember.full_name,
        email: signedMember.email,
        waiver_id: waiverId,
        signed_count: signedCount ?? 0,
        expected_count: expected,
      },
    })
  }

  if (reservation && reservation.status === 'open') {
    if (expected > 0 && (signedCount ?? 0) >= expected) {
      await admin.from('reservations').update({ status: 'complete' }).eq('id', reservationId)
      // Whole party done — emit reservation.completed (best-effort).
      if (reservation.operator_id) {
        await emitWebhookEvent(admin, {
          operatorId: reservation.operator_id,
          eventType: 'reservation.completed',
          data: {
            reservation_id: reservation.id,
            activity_key: reservation.activity_key,
            signed_count: signedCount ?? 0,
            expected_count: expected,
          },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
