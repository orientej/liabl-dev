// lib/reservation-create.ts
// Server-only shared reservation creation, used by BOTH the public API
// (POST /api/v1/reservations) and inbound connectors (POST /api/connectors/…).
// Creates the bound session + reservation + optional attendees (mode-aware,
// so a test credential/connector produces sandbox data), optionally emails
// invites, and returns the check-in links. Keeping this in one place means the
// API and connectors can never drift in how a booking becomes a reservation.

import { createAdminClient } from '@/lib/supabase-admin'
import { sendReservationInviteEmail } from '@/lib/email'
import {
  reservationSelfServiceUrl, reservationCheckInUrl, reservationGroupCheckInUrl, reservationMemberCheckInUrl,
} from '@/lib/participant-url'

type AdminClient = ReturnType<typeof createAdminClient>

export interface ReservationCreateInput {
  operatorId: string
  mode: 'live' | 'test'
  activityKey: string
  reservationDate?: string | null
  partySize?: number | null
  organizerName?: string | null
  organizerEmail?: string | null
  members?: { full_name?: string; email?: string }[]
  sendInvites?: boolean
  sessionRefPrefix?: string        // 'API' (default) or 'Connector: FareHarbor', etc.
}

export interface CreatedMember { id: string; full_name: string | null; email: string | null; check_in_url: string }
export interface ReservationCreateResult {
  id: string
  status: string
  activityKey: string
  reservationDate: string
  links: { self_service: string; shared_check_in: string; group_leader: string }
  members: CreatedMember[]
}

// Either `result` (success) or `error` (a validation failure the caller maps
// to a 4xx). A thrown error signals an unexpected server failure (5xx).
export interface ReservationCreateOutcome {
  result?: ReservationCreateResult
  error?: { code: string; message: string }
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function createApiReservation(admin: AdminClient, input: ReservationCreateInput): Promise<ReservationCreateOutcome> {
  const activityKey = input.activityKey?.trim() || ''
  if (!activityKey) return { error: { code: 'invalid_request', message: 'activity_key is required.' } }

  // The activity must belong to this operator.
  const { data: activity } = await admin
    .from('activities').select('id, display_name').eq('operator_id', input.operatorId).eq('key', activityKey).maybeSingle()
  if (!activity) return { error: { code: 'unknown_activity', message: `No activity "${activityKey}" for this operator.` } }

  const reservationDate = input.reservationDate || todayISO()
  const organizerName = input.organizerName?.trim() || null
  const prefix = input.sessionRefPrefix || 'API'

  // Auto-create a bound session (reuses the whole check-in machinery), mode-stamped.
  const { data: session, error: sErr } = await admin
    .from('sessions')
    .insert({ operator_id: input.operatorId, session_ref: `${prefix}: ${organizerName || 'Reservation'}`, session_time: null, session_date: reservationDate, activity_key: activityKey, mode: input.mode })
    .select('id').single()
  if (sErr) throw new Error(`session: ${sErr.message}`)

  const { data: reservation, error: rErr } = await admin
    .from('reservations')
    .insert({
      operator_id: input.operatorId,
      activity_key: activityKey,
      session_id: session!.id,
      reservation_date: reservationDate,
      party_size: typeof input.partySize === 'number' ? input.partySize : null,
      organizer_name: organizerName,
      organizer_email: input.organizerEmail?.trim().toLowerCase() || null,
      mode: input.mode,
    })
    .select('id, self_service_token, status')
    .single()
  if (rErr) throw new Error(`reservation: ${rErr.message}`)

  // Optional attendees (+ optional invite emails).
  const memberInput = input.members ?? []
  const createdMembers: CreatedMember[] = []
  if (memberInput.length > 0) {
    const rows = memberInput.map(m => ({
      reservation_id: reservation!.id, operator_id: input.operatorId,
      full_name: m.full_name?.trim() || null, email: m.email?.trim().toLowerCase() || null,
    }))
    const { data: inserted } = await admin.from('reservation_members').insert(rows).select('id, full_name, email, member_token')

    let operatorNameLabel = 'the operator'
    if (input.sendInvites) {
      const { data: op } = await admin.from('operators').select('name').eq('id', input.operatorId).maybeSingle()
      operatorNameLabel = op?.name ?? operatorNameLabel
    }
    const activityLabel = activity.display_name ?? activityKey

    for (const m of inserted ?? []) {
      createdMembers.push({ id: m.id, full_name: m.full_name, email: m.email, check_in_url: reservationMemberCheckInUrl(m.member_token) })
      if (input.sendInvites && m.email) {
        try {
          await sendReservationInviteEmail({
            to: m.email, organizerName: organizerName || 'The organizer',
            operatorName: operatorNameLabel, activityLabel, reservationDate,
            checkInUrl: reservationMemberCheckInUrl(m.member_token),
          })
          await admin.from('reservation_members').update({ invited_at: new Date().toISOString() }).eq('id', m.id)
        } catch { /* invite email best-effort */ }
      }
    }
  }

  return {
    result: {
      id: reservation!.id,
      status: reservation!.status,
      activityKey,
      reservationDate,
      links: {
        self_service: reservationSelfServiceUrl(reservation!.self_service_token),
        shared_check_in: reservationCheckInUrl(reservation!.id),
        group_leader: reservationGroupCheckInUrl(reservation!.id),
      },
      members: createdMembers,
    },
  }
}
