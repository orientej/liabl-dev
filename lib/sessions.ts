// lib/sessions.ts
// Session (check-in link) management. Relies entirely on the existing
// sessions_manage_own RLS policy (011_m5_rls_tighten.sql) for scoping —
// no new authorization logic needed here, same as most operator-facing
// lib files in this app.

import { createClient } from '@/lib/supabase'

export interface SessionRecord {
  id: string
  sessionRef: string
  sessionTime: string | null
  sessionDate: string   // ISO date, e.g. "2026-07-15"
  activityKey: string
  waiverCount: number
}

export async function listSessions(operatorId: string): Promise<SessionRecord[]> {
  const supabase = createClient()

  const [{ data: sessions, error }, { data: waiverRows }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_ref, session_time, session_date, activity_key')
      .eq('operator_id', operatorId)
      .order('session_date', { ascending: false }),
    supabase
      .from('waivers')
      .select('session_id')
      .eq('operator_id', operatorId)
      .not('signed_at', 'is', null),
  ])

  if (error) throw new Error(`list sessions: ${error.message}`)

  const countBySession = new Map<string, number>()
  for (const row of waiverRows ?? []) {
    if (row.session_id) countBySession.set(row.session_id, (countBySession.get(row.session_id) ?? 0) + 1)
  }

  return (sessions ?? []).map(s => ({
    id: s.id,
    sessionRef: s.session_ref ?? '',
    sessionTime: s.session_time,
    sessionDate: s.session_date,
    activityKey: s.activity_key,
    waiverCount: countBySession.get(s.id) ?? 0,
  }))
}

export interface CreateSessionInput {
  operatorId: string
  sessionRef: string
  sessionTime: string
  sessionDate: string
  activityKey: string
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      operator_id: input.operatorId,
      session_ref: input.sessionRef.trim(),
      session_time: input.sessionTime.trim() || null,
      session_date: input.sessionDate,
      activity_key: input.activityKey,
    })
    .select('id')
    .single()

  if (error) throw new Error(`create session: ${error.message}`)
  if (!data) throw new Error('create session returned no data')
  return data.id
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) {
    // Postgres's default FK behavior (no ON DELETE clause on
    // waivers.session_id) refuses this automatically if any waiver
    // already references the session — surface that plainly rather than
    // a raw constraint-violation message.
    if (error.message.toLowerCase().includes('foreign key')) {
      throw new Error('This session has signed waivers on file and can\'t be deleted.')
    }
    throw new Error(`delete session: ${error.message}`)
  }
}
