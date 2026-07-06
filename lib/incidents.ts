// lib/incidents.ts
// v24 M2 fix — real incident data access, replacing IncidentTab's local
// React state. Kept separate from the component so the same queries can
// be reused (e.g. an Analytics "open incidents" count in a later milestone)
// without duplicating Supabase calls inside UI code.

import { createClient } from '@/lib/supabase'

export type IncidentSeverity = 'minor' | 'moderate' | 'serious'
export type IncidentStatus = 'open' | 'notified' | 'investigating' | 'closed'

export interface WaiverSearchResult {
  waiverId: string
  participantName: string
  activityKey: string
  signedAt: string | null
}

export interface IncidentRecord {
  id: string
  ref: string
  waiverId: string | null
  participantName: string
  activity: string | null
  severity: IncidentSeverity
  description: string
  status: IncidentStatus
  carrierNotifiedAt: string | null
  notifiedBy: string | null
  createdAt: string
}

export interface CreateIncidentInput {
  waiverId: string | null
  participantName: string
  activity: string
  severity: IncidentSeverity
  description: string
}

/**
 * Search signed waivers by participant name, for the incident form's
 * "link to an existing waiver" picker. Falls back gracefully to an
 * empty result on error — the form's free-text path still works even
 * if this search fails, by design (see decision: search OR free text).
 */
export async function searchWaiversByParticipant(query: string): Promise<WaiverSearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('waivers')
    .select('id, activity_key, signed_at, participants(full_name)')
    .not('signed_at', 'is', null)
    .ilike('participants.full_name', `%${query.trim()}%`)
    .order('signed_at', { ascending: false })
    .limit(8)

  if (error) {
    console.error('[searchWaiversByParticipant]', error.message)
    return []
  }

  return (data ?? [])
    .map((row: Record<string, unknown>) => {
      const participant = Array.isArray(row.participants)
        ? (row.participants[0] as { full_name?: string } | undefined)
        : (row.participants as { full_name?: string } | null)
      if (!participant?.full_name) return null
      return {
        waiverId: row.id as string,
        participantName: participant.full_name,
        activityKey: row.activity_key as string,
        signedAt: row.signed_at as string | null,
      }
    })
    .filter((r): r is WaiverSearchResult => r !== null)
}

function nextIncidentRef(existingCount: number): string {
  // Reference-implementation ref generator. Production should use a
  // database sequence or a per-year counter to avoid collisions across
  // concurrent filings — this is a placeholder, not a uniqueness guarantee.
  const year = new Date().getFullYear()
  return `INC-${year}-${String(existingCount + 1).padStart(4, '0')}`
}

/**
 * Files a real incident and, if it's linked to a waiver, applies a real
 * legal hold to that waiver in the same operation. This does NOT notify
 * any carrier — that is a deliberate, separate, logged step
 * (see markCarrierNotified). Filing an incident must never imply an
 * insurer has been contacted unless a human has actually done it.
 */
export async function createIncident(input: CreateIncidentInput): Promise<IncidentRecord> {
  const supabase = createClient()

  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })

  const ref = nextIncidentRef(count ?? 0)

  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .insert({
      ref,
      waiver_id: input.waiverId,
      participant_name: input.participantName,
      activity: input.activity,
      severity: input.severity,
      description: input.description,
      status: 'open',
    })
    .select('*')
    .single()

  if (incidentError) throw new Error(`incident insert: ${incidentError.message}`)
  if (!incident) throw new Error('incident insert returned no data')

  // Real legal hold — only possible when there's a waiver to hold.
  // A free-text incident with no waiver link has nothing to hold yet;
  // this is surfaced to the operator in the UI rather than silently skipped.
  if (input.waiverId) {
    const { error: holdError } = await supabase
      .from('waivers')
      .update({ legal_hold: true })
      .eq('id', input.waiverId)

    if (holdError) {
      // The incident itself was filed successfully — don't lose that —
      // but the hold failing is a real problem the operator needs to know
      // about, not something to swallow silently.
      throw new Error(
        `incident ${ref} was filed, but applying the legal hold failed: ${holdError.message}. ` +
        `Retry the hold manually or contact support — do not assume this waiver is protected.`
      )
    }
  }

  return mapIncidentRow(incident)
}

/**
 * Logs a carrier notification as a deliberate, attributable action.
 * There is no real webhook integration yet (that's Milestone 2's
 * FareHarbor/Rezdy-adjacent work, deferred) — this records that a human
 * told the carrier, by phone/email/portal, outside this system.
 */
export async function markCarrierNotified(incidentId: string, notifiedBy: string): Promise<IncidentRecord> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('incidents')
    .update({
      status: 'notified',
      carrier_notified_at: new Date().toISOString(),
      notified_by: notifiedBy,
    })
    .eq('id', incidentId)
    .select('*')
    .single()

  if (error) throw new Error(`mark carrier notified: ${error.message}`)
  if (!data) throw new Error('mark carrier notified returned no data')
  return mapIncidentRow(data)
}

export async function updateIncidentStatus(incidentId: string, status: IncidentStatus): Promise<IncidentRecord> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('incidents')
    .update({ status })
    .eq('id', incidentId)
    .select('*')
    .single()

  if (error) throw new Error(`update incident status: ${error.message}`)
  if (!data) throw new Error('update incident status returned no data')
  return mapIncidentRow(data)
}

export async function listIncidents(): Promise<IncidentRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listIncidents]', error.message)
    return []
  }
  return (data ?? []).map(mapIncidentRow)
}

function mapIncidentRow(row: Record<string, unknown>): IncidentRecord {
  return {
    id: row.id as string,
    ref: row.ref as string,
    waiverId: row.waiver_id as string | null,
    participantName: row.participant_name as string,
    activity: row.activity as string | null,
    severity: row.severity as IncidentSeverity,
    description: row.description as string,
    status: row.status as IncidentStatus,
    carrierNotifiedAt: row.carrier_notified_at as string | null,
    notifiedBy: row.notified_by as string | null,
    createdAt: row.created_at as string,
  }
}
