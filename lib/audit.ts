// lib/audit.ts
// v24 M2 item 4 — real audit event logging and retrieval
//
// Two surfaces:
//   logEvent()               — called from ParticipantFlow and seal.ts
//   fetchWaiverAuditTrail()  — called from WaiverDetail to replace the
//                              four hardcoded fake timeline lines
//
// logEvent is fire-and-forget from the caller's perspective: it never
// throws. Audit logging must never fail a signing flow.

import { createClient } from '@/lib/supabase'
import { createClient as createAnonClient } from '@/lib/supabase-anon'

// ── Event types (string union for autocomplete, not an exhaustive enum) ───────
export type AuditEventType =
  | 'session.started'
  | 'waiver.generated'
  | 'document.viewed'
  | 'waiver.signed'
  | 'document.sealed'

export interface AuditEventInput {
  eventType:  AuditEventType
  sessionId:  string | null
  waiverId?:  string | null
  // v25 M5 RLS — nullable because the very first event of a flow
  // (session.started) fires before the operator's data has loaded; see
  // 011_m5_rls_tighten.sql's backfill comment on audit_events.operator_id.
  operatorId?: string | null
  metadata?:  Record<string, unknown>
  ipAddress?: string | null
}

export interface AuditEvent {
  id:         string
  eventType:  AuditEventType
  sessionId:  string | null
  waiverId:   string | null
  metadata:   Record<string, unknown> | null
  ipAddress:  string | null
  createdAt:  string
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Log an audit event. Fire-and-forget — never throws.
 * Callers don't need to await this if they don't want to (the signing
 * flow awaits it for waiver.signed and document.sealed so timestamps are
 * accurate; pre-signing events can be fire-and-forget).
 */
export async function logEvent(input: AuditEventInput): Promise<void> {
  try {
    // v25 fix — genuinely anonymous client, not the shared session-
    // syncing one. logEvent is only ever called from the participant
    // flow (never authenticated), and audit_events_public_insert's
    // policy already accepts any role — so this wasn't the cause of the
    // reported RLS error, but using the same shared client here would
    // still mean a co-existing operator/admin session bleeds into what
    // should be an anonymous participant's audit trail. Kept consistent
    // with the same fix applied to the actual signing path.
    const supabase = createAnonClient()
    const { error } = await supabase.from('audit_events').insert({
      event_type:  input.eventType,
      session_id:  input.sessionId,
      waiver_id:   input.waiverId ?? null,
      operator_id: input.operatorId ?? null,
      metadata:    input.metadata ?? null,
      ip_address:  input.ipAddress ?? null,
    })
    if (error) {
      // Log but never surface to the user — audit logging is never
      // allowed to fail a signing flow or break the UI.
      console.error('[audit] logEvent failed:', input.eventType, error.message)
    }
  } catch (err) {
    console.error('[audit] logEvent threw:', input.eventType, err)
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all audit events for a given waiver, ordered oldest-first for
 * timeline display. Also includes session-level events (session.started,
 * waiver.generated, document.viewed) by joining on the waiver's session_id,
 * so the full flow is represented even though those events have no waiver_id.
 */
export async function fetchWaiverAuditTrail(
  waiverId: string,
  sessionId: string | null
): Promise<AuditEvent[]> {
  const supabase = createClient()

  // Two queries merged client-side:
  // 1. Events directly on this waiver (waiver.signed, document.sealed)
  // 2. Pre-signing events on the same session (session.started, waiver.generated, document.viewed)
  // Combined and sorted by created_at ascending for chronological display.

  const queries: Promise<AuditEvent[]>[] = []

  // Waiver-level events
  queries.push(
    Promise.resolve(
      supabase
        .from('audit_events')
        .select('*')
        .eq('waiver_id', waiverId)
        .order('created_at', { ascending: true })
    ).then(({ data, error }) => {
      if (error) { console.error('[audit] waiver events fetch:', error.message); return [] }
      return (data ?? []).map(mapRow)
    })
  )

  // Session-level pre-signing events (only if we have a session_id)
  if (sessionId) {
    queries.push(
      Promise.resolve(
        supabase
          .from('audit_events')
          .select('*')
          .eq('session_id', sessionId)
          .is('waiver_id', null)
          .in('event_type', ['session.started', 'waiver.generated', 'document.viewed'])
          .order('created_at', { ascending: true })
      ).then(({ data, error }) => {
        if (error) { console.error('[audit] session events fetch:', error.message); return [] }
        return (data ?? []).map(mapRow)
      })
    )
  }

  const [waiverEvents, sessionEvents = []] = await Promise.all(queries)

  // Merge and sort chronologically
  return [...waiverEvents, ...sessionEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

function mapRow(row: Record<string, unknown>): AuditEvent {
  return {
    id:        row.id as string,
    eventType: row.event_type as AuditEventType,
    sessionId: row.session_id as string | null,
    waiverId:  row.waiver_id as string | null,
    metadata:  row.metadata as Record<string, unknown> | null,
    ipAddress: row.ip_address as string | null,
    createdAt: row.created_at as string,
  }
}
