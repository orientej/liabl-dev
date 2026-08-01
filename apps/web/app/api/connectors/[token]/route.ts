// app/api/connectors/[token]/route.ts
// Public API — Phase D3 inbound connector endpoint. A booking engine POSTs a
// booking here; Liabl maps it to a reservation and returns the check-in links.
//
//   POST /api/connectors/{inbound_token}
//     Body: the engine's booking payload (or the generic normalized shape).
//     Optional header X-Liabl-Connector-Signature: hex HMAC-SHA256 of the raw
//     body with the connector's signing secret (required when a secret is set).
//   -> { reservation_id, links, members }   (or a connector error)
//
// PUBLIC (no session): the unguessable inbound token + optional HMAC are the
// auth. Runs on the service-role client; the operator + mode are taken from
// the connector, never the request. Every call is recorded in connector_events.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createApiReservation } from '@/lib/reservation-create'
import { mapBooking, resolveActivityKey, verifyConnectorSignature, type ConnectorType } from '@/lib/connectors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const admin = createAdminClient()

  const { data: connector } = await admin
    .from('connectors')
    .select('id, operator_id, type, signing_secret, default_activity_key, activity_map, mode, active')
    .eq('inbound_token', token)
    .maybeSingle()

  if (!connector || !connector.active) {
    return NextResponse.json({ error: 'unknown_connector' }, { status: 404 })
  }

  const log = (status: string, extra: { externalRef?: string | null; reservationId?: string | null; error?: string }) =>
    admin.from('connector_events').insert({
      connector_id: connector.id, operator_id: connector.operator_id, status,
      external_ref: extra.externalRef ?? null, reservation_id: extra.reservationId ?? null, error: extra.error ?? null,
    }).then(() => {}, () => {})

  // Read the raw body once — signature verification must hash the exact bytes.
  const rawBody = await request.text().catch(() => '')

  if (connector.signing_secret) {
    const ok = verifyConnectorSignature(connector.signing_secret, rawBody, request.headers.get('x-liabl-connector-signature'))
    if (!ok) {
      await log('unauthorized', { error: 'signature verification failed' })
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try { payload = rawBody ? JSON.parse(rawBody) : {} } catch { payload = {} }

  const booking = mapBooking(connector.type as ConnectorType, payload as Record<string, any>)
  const activityKey = resolveActivityKey(connector, booking)
  if (!activityKey) {
    await log('ignored', { externalRef: booking.externalRef, error: 'no activity mapping for this booking' })
    return NextResponse.json({ error: 'no_activity_mapping', message: 'Could not resolve a Liabl activity for this booking. Set a default activity or an activity map on the connector.' }, { status: 422 })
  }

  try {
    const outcome = await createApiReservation(admin, {
      operatorId: connector.operator_id,
      mode: connector.mode,
      activityKey,
      reservationDate: booking.reservationDate,
      partySize: booking.partySize,
      organizerName: booking.organizerName,
      organizerEmail: booking.organizerEmail,
      members: booking.members,
      sendInvites: false,   // connectors don't email by default; the engine owns customer comms
      sessionRefPrefix: `Connector: ${connector.type}`,
    })

    if (outcome.error) {
      await log('error', { externalRef: booking.externalRef, error: `${outcome.error.code}: ${outcome.error.message}` })
      return NextResponse.json({ error: outcome.error.code, message: outcome.error.message }, { status: 422 })
    }

    const r = outcome.result!
    await Promise.all([
      log('created', { externalRef: booking.externalRef, reservationId: r.id }),
      admin.from('connectors').update({ last_event_at: new Date().toISOString() }).eq('id', connector.id),
    ])
    return NextResponse.json({ reservation_id: r.id, external_ref: booking.externalRef, links: r.links, members: r.members }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed to create reservation'
    await log('error', { externalRef: booking.externalRef, error: msg })
    return NextResponse.json({ error: 'server_error', message: msg }, { status: 500 })
  }
}
