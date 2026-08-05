// lib/reservations.ts
// Group reservations — operator-side CRUD + progress. Uses the normal
// authenticated browser client throughout; reservations_manage_own /
// reservation_members_manage_own (025_reservations.sql) scope everything
// here to the caller's own operator via RLS, same as lib/sessions.ts and
// lib/invites.ts.
//
// The organizer self-service page and the participant flow do NOT use this
// file — they reach reservation data through tokenised admin-client routes
// (no public-read exists), see app/api/reservations/*.

import { createClient } from '@/lib/supabase'

export interface ReservationRecord {
  id:               string
  activityKey:      string
  sessionId:        string | null
  reservationDate:  string | null
  partySize:        number | null
  organizerName:    string | null
  organizerEmail:   string | null
  status:           'open' | 'complete' | 'cancelled'
  selfServiceToken: string
  notes:            string | null
  createdAt:        string
  // Progress
  memberCount:      number   // invited attendees on the named roster
  signedCount:      number   // waivers linked to this reservation that are signed
  checkedInCount:   number   // signed waivers that have also been checked in
  expectedCount:    number   // max(partySize, memberCount)
}

export interface ReservationMemberRecord {
  id:         string
  fullName:   string | null
  email:      string | null
  memberToken: string
  waiverId:   string | null
  status:     'invited' | 'signed'
  invitedAt:  string | null
  createdAt:  string
}

export interface CreateReservationInput {
  operatorId:       string
  activityKey:      string
  sessionId?:       string | null
  reservationDate?: string | null
  partySize?:       number | null
  organizerName?:   string | null
  organizerEmail?:  string | null
  notes?:           string | null
  createdByUserId?: string | null
}

export async function createReservation(input: CreateReservationInput): Promise<{ id: string; selfServiceToken: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      operator_id:      input.operatorId,
      activity_key:     input.activityKey,
      session_id:       input.sessionId ?? null,
      reservation_date: input.reservationDate ?? null,
      party_size:       input.partySize ?? null,
      organizer_name:   input.organizerName ?? null,
      organizer_email:  input.organizerEmail ?? null,
      notes:            input.notes ?? null,
      created_by:       input.createdByUserId ?? null,
    })
    .select('id, self_service_token')
    .single()

  if (error) throw new Error(`create reservation: ${error.message}`)
  if (!data) throw new Error('create reservation returned no data')
  return { id: data.id, selfServiceToken: data.self_service_token }
}

/** Lists an operator's reservations with progress. */
export async function listReservations(operatorId: string): Promise<ReservationRecord[]> {
  const supabase = createClient()

  const [{ data: rows, error }, { data: members }, { data: signed }] = await Promise.all([
    supabase
      .from('reservations')
      .select('id, activity_key, session_id, reservation_date, party_size, organizer_name, organizer_email, status, self_service_token, notes, created_at')
      .eq('operator_id', operatorId)
      .neq('mode', 'test')   // sandbox reservations stay out of the operator console
      .order('created_at', { ascending: false }),
    supabase
      .from('reservation_members')
      .select('reservation_id')
      .eq('operator_id', operatorId),
    supabase
      .from('waivers')
      .select('reservation_id, signed_at, checked_in_at')
      .eq('operator_id', operatorId)
      .not('reservation_id', 'is', null)
      .not('signed_at', 'is', null),
  ])

  if (error) throw new Error(`list reservations: ${error.message}`)

  const memberCounts = new Map<string, number>()
  for (const m of members ?? []) memberCounts.set(m.reservation_id, (memberCounts.get(m.reservation_id) ?? 0) + 1)
  const signedCounts = new Map<string, number>()
  const checkedInCounts = new Map<string, number>()
  for (const w of signed ?? []) {
    if (!w.reservation_id) continue
    signedCounts.set(w.reservation_id, (signedCounts.get(w.reservation_id) ?? 0) + 1)
    if (w.checked_in_at) checkedInCounts.set(w.reservation_id, (checkedInCounts.get(w.reservation_id) ?? 0) + 1)
  }

  return (rows ?? []).map(r => {
    const memberCount = memberCounts.get(r.id) ?? 0
    const signedCount = signedCounts.get(r.id) ?? 0
    return {
      id:               r.id,
      activityKey:      r.activity_key,
      sessionId:        r.session_id ?? null,
      reservationDate:  r.reservation_date ?? null,
      partySize:        r.party_size ?? null,
      organizerName:    r.organizer_name ?? null,
      organizerEmail:   r.organizer_email ?? null,
      status:           r.status,
      selfServiceToken: r.self_service_token,
      notes:            r.notes ?? null,
      createdAt:        r.created_at,
      memberCount,
      signedCount,
      checkedInCount:   checkedInCounts.get(r.id) ?? 0,
      expectedCount:    Math.max(r.party_size ?? 0, memberCount),
    }
  })
}

/** Edit the expected party size after creation (Issue 2). Null clears it,
 * which falls the expected count back to the named-attendee count. */
export async function updateReservationPartySize(reservationId: string, partySize: number | null): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('reservations')
    .update({ party_size: partySize && partySize > 0 ? Math.round(partySize) : null })
    .eq('id', reservationId)
  if (error) throw new Error(`update party size: ${error.message}`)
}

export async function listReservationMembers(reservationId: string): Promise<ReservationMemberRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reservation_members')
    .select('id, full_name, email, member_token, waiver_id, status, invited_at, created_at')
    .eq('reservation_id', reservationId)
    .order('created_at')

  if (error) throw new Error(`list reservation members: ${error.message}`)
  return (data ?? []).map(m => ({
    id: m.id, fullName: m.full_name ?? null, email: m.email ?? null,
    memberToken: m.member_token, waiverId: m.waiver_id ?? null,
    status: m.status, invitedAt: m.invited_at ?? null, createdAt: m.created_at,
  }))
}

export async function addReservationMember(
  reservationId: string,
  operatorId: string,
  member: { fullName?: string | null; email?: string | null },
): Promise<{ id: string; memberToken: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reservation_members')
    .insert({
      reservation_id: reservationId,
      operator_id:    operatorId,
      full_name:      member.fullName?.trim() || null,
      email:          member.email?.trim().toLowerCase() || null,
    })
    .select('id, member_token')
    .single()

  if (error) throw new Error(`add reservation member: ${error.message}`)
  if (!data) throw new Error('add reservation member returned no data')
  return { id: data.id, memberToken: data.member_token }
}

export async function removeReservationMember(memberId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('reservation_members').delete().eq('id', memberId)
  if (error) throw new Error(`remove reservation member: ${error.message}`)
}

export async function setReservationStatus(reservationId: string, status: 'open' | 'complete' | 'cancelled'): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('reservations').update({ status }).eq('id', reservationId)
  if (error) throw new Error(`set reservation status: ${error.message}`)
}

/** Marks a member as invited now (called after the invite email is sent). */
export async function markMemberInvited(memberId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('reservation_members')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw new Error(`mark member invited: ${error.message}`)
}
