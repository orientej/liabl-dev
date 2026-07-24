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
  // Content Management Phase 1 — version pinning.
  // pinnedVersionId/Number: this session is pinned to a specific version
  // (set explicitly, or by a "keep pinned" republish). Null = follows the
  // activity's current published version.
  pinnedVersionId: string | null
  pinnedVersionNumber: number | null
  // The activity's current published version — what an unpinned session
  // actually resolves to right now. Null if the activity has never been
  // published under the versioning model.
  activityCurrentVersionId: string | null
  activityCurrentVersionNumber: number | null
  // Session archiving: null = active. An archived session is hidden from
  // the default Sessions list and from the roster's "All participants"
  // view, and stops accepting new signatures.
  archivedAt: string | null
}

/**
 * Lists an operator's sessions. Archived sessions are EXCLUDED by
 * default — callers that need them (the Sessions tab's "show archived"
 * view, and the roster's session filter, which lists archived sessions
 * separately so their signed waivers stay reachable) opt in explicitly.
 */
export async function listSessions(
  operatorId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<SessionRecord[]> {
  const supabase = createClient()

  const [{ data: sessions, error }, { data: waiverRows }, { data: activities }, { data: versions }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_ref, session_time, session_date, activity_key, pinned_version_id, archived_at')
      .eq('operator_id', operatorId)
      .order('session_date', { ascending: false }),
    supabase
      .from('waivers')
      .select('session_id')
      .eq('operator_id', operatorId)
      .not('signed_at', 'is', null),
    supabase
      .from('activities')
      .select('key, current_version_id, current_version_number')
      .eq('operator_id', operatorId),
    supabase
      .from('template_versions')
      .select('id, version_number')
      .eq('operator_id', operatorId),
  ])

  if (error) throw new Error(`list sessions: ${error.message}`)

  const countBySession = new Map<string, number>()
  for (const row of waiverRows ?? []) {
    if (row.session_id) countBySession.set(row.session_id, (countBySession.get(row.session_id) ?? 0) + 1)
  }
  const activityByKey = new Map((activities ?? []).map(a => [a.key, a]))
  const versionNumberById = new Map((versions ?? []).map(v => [v.id, v.version_number]))

  return (sessions ?? []).map(s => {
    const activity = activityByKey.get(s.activity_key)
    return {
      id: s.id,
      sessionRef: s.session_ref ?? '',
      sessionTime: s.session_time,
      sessionDate: s.session_date,
      activityKey: s.activity_key,
      waiverCount: countBySession.get(s.id) ?? 0,
      pinnedVersionId: s.pinned_version_id ?? null,
      pinnedVersionNumber: s.pinned_version_id ? (versionNumberById.get(s.pinned_version_id) ?? null) : null,
      activityCurrentVersionId: activity?.current_version_id ?? null,
      activityCurrentVersionNumber: activity?.current_version_number ?? null,
      archivedAt: s.archived_at ?? null,
    }
  }).filter(rec => opts.includeArchived || rec.archivedAt === null)
}

/**
 * Archives or restores a session. Archiving is soft — nothing is
 * deleted, and the session (with its signed waivers) stays reachable
 * through the archived views. deleteSession() remains the tool for
 * genuine removal.
 */
export async function setSessionArchived(sessionId: string, archived: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', sessionId)
  if (error) throw new Error(`${archived ? 'archive' : 'restore'} session: ${error.message}`)
}

export interface AvailableVersion {
  id: string
  versionNumber: number
}

/** All published versions for a session's activity, newest first — the
 *  choices an operator can pin a session to. */
export async function listVersionsForActivity(operatorId: string, activityKey: string): Promise<AvailableVersion[]> {
  const supabase = createClient()
  const { data: activity } = await supabase
    .from('activities')
    .select('id')
    .eq('operator_id', operatorId)
    .eq('key', activityKey)
    .maybeSingle()
  if (!activity) return []

  const { data, error } = await supabase
    .from('template_versions')
    .select('id, version_number')
    .eq('activity_id', activity.id)
    .order('version_number', { ascending: false })

  if (error) throw new Error(`list versions for activity: ${error.message}`)
  return (data ?? []).map(v => ({ id: v.id, versionNumber: v.version_number }))
}

/**
 * Sets (or clears) a session's pinned version.
 *   versionId = a template_versions.id  -> pin to that specific version
 *   versionId = null                    -> unpin, i.e. follow the
 *                                          activity's current version
 */
export async function setSessionPinnedVersion(sessionId: string, versionId: string | null): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ pinned_version_id: versionId })
    .eq('id', sessionId)
  if (error) throw new Error(`set session version: ${error.message}`)
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
