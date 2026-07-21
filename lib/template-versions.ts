// lib/template-versions.ts
// Content Management Phase 1 — template version publishing + history.
//
// An "activity" functionally IS a template: it owns a set of
// activity_clauses + activity_questions, which operators edit freely in
// TemplateTab (that's the working "draft"). Publishing captures an
// immutable snapshot of that entire set into template_versions
// (migration 021), bumps the version number, and points the activity at
// the new version.
//
// Reads of live/draft template content still go through fetchEngineData
// in document-engine.ts — this file is the versioning mutations +
// version-history reads, same split as lib/activity-admin.ts.

import { createClient } from '@/lib/supabase'

// ── Snapshot shape ──────────────────────────────────────────────────
// Must match exactly what migration 021's comment documents and what the
// participant flow reconstructs from. clause.questionKey references a
// question by its stable snapshot key (the question's id at publish
// time), NOT a live activity_questions row — so conditional links
// survive independently of the mutable tables.

export interface SnapshotClause {
  key:          string
  title:        string
  bodyTemplate: string
  required:     boolean
  highlight:    boolean
  sortOrder:    number
  questionKey:  string | null
}

export interface SnapshotQuestion {
  key:            string   // the question's id at publish time
  text:           string
  type:           'yes_no' | 'text' | 'multiple'
  options:        string[] | null
  sortOrder:      number
  triggersClause: boolean
  triggerValue:   string
}

export interface TemplateSnapshot {
  activity: {
    displayName:   string
    icon:          string
    accentColor:   string
    baseRiskScore: number
  }
  clauses:   SnapshotClause[]
  questions: SnapshotQuestion[]
}

export interface TemplateVersion {
  id:              string
  activityId:      string
  versionNumber:   number
  snapshot:        TemplateSnapshot
  changeNote:      string | null
  publishedByEmail: string | null
  publishedAt:     string
}

/**
 * Builds the snapshot for an activity from its CURRENT live clause and
 * question rows — i.e. whatever the draft currently says. Global
 * (operator-wide, activity_id null) clauses and questions are included
 * alongside the activity-specific ones, matching how fetchEngineData
 * composes them for the participant flow, so a published version is a
 * complete, self-contained record of exactly what a participant would
 * have signed.
 */
async function buildSnapshot(operatorId: string, activityId: string): Promise<TemplateSnapshot> {
  const supabase = createClient()

  const [{ data: activity, error: aErr }, { data: clauses, error: cErr }, { data: questions, error: qErr }] = await Promise.all([
    supabase.from('activities').select('display_name, icon, accent_color, base_risk_score').eq('id', activityId).maybeSingle(),
    supabase.from('activity_clauses')
      .select('key, title, body_template, required, highlight, sort_order, question_id')
      .or(`activity_id.eq.${activityId},and(activity_id.is.null,operator_id.eq.${operatorId})`)
      .order('sort_order'),
    supabase.from('activity_questions')
      .select('id, text, type, options, sort_order, triggers_clause, trigger_value')
      .or(`activity_id.eq.${activityId},and(activity_id.is.null,operator_id.eq.${operatorId})`)
      .order('sort_order'),
  ])

  if (aErr) throw new Error(`snapshot activity: ${aErr.message}`)
  if (cErr) throw new Error(`snapshot clauses: ${cErr.message}`)
  if (qErr) throw new Error(`snapshot questions: ${qErr.message}`)
  if (!activity) throw new Error('snapshot: activity not found')

  return {
    activity: {
      displayName:   activity.display_name,
      icon:          activity.icon,
      accentColor:   activity.accent_color,
      baseRiskScore: activity.base_risk_score,
    },
    clauses: (clauses ?? []).map(c => ({
      key:          c.key,
      title:        c.title,
      bodyTemplate: c.body_template,
      required:     c.required,
      highlight:    c.highlight,
      sortOrder:    c.sort_order,
      questionKey:  c.question_id ? String(c.question_id) : null,
    })),
    questions: (questions ?? []).map(q => ({
      key:            String(q.id),
      text:           q.text,
      type:           q.type,
      options:        q.options,
      sortOrder:      q.sort_order,
      triggersClause: q.triggers_clause,
      triggerValue:   q.trigger_value,
    })),
  }
}

export interface PublishInput {
  operatorId:  string
  activityId:  string
  changeNote?: string
  /**
   * When republishing an activity that already has scheduled sessions,
   * the operator decides what happens to those sessions (the locked
   * decision: this is a per-republish choice, not a fixed rule):
   *   'move'   — sessions following current auto-advance to the new
   *              version (default; right for typo/wording fixes)
   *   'pin'    — existing sessions currently following current get
   *              pinned to the OUTGOING version, so participants sign
   *              what they were already going to sign (right for
   *              substantive legal changes)
   * Ignored on the very first publish (no prior version to pin to).
   */
  existingSessions?: 'move' | 'pin'
}

/**
 * Publishes the activity's current draft as a new immutable version.
 * Returns the new version's id and number.
 */
export async function publishTemplateVersion(input: PublishInput): Promise<{ versionId: string; versionNumber: number }> {
  const supabase = createClient()

  // Current published version (if any) — needed both to compute the next
  // number and to know what to pin existing sessions to.
  const { data: activityRow, error: actErr } = await supabase
    .from('activities')
    .select('current_version_id, current_version_number')
    .eq('id', input.activityId)
    .maybeSingle()
  if (actErr) throw new Error(`publish (read activity): ${actErr.message}`)
  if (!activityRow) throw new Error('publish: activity not found')

  const outgoingVersionId = activityRow.current_version_id as string | null
  const nextNumber = (activityRow.current_version_number ?? 0) + 1

  const snapshot = await buildSnapshot(input.operatorId, input.activityId)

  // Capture the current signed-in user for attribution.
  const { data: { user } } = await supabase.auth.getUser()

  const { data: version, error: insErr } = await supabase
    .from('template_versions')
    .insert({
      operator_id:        input.operatorId,
      activity_id:        input.activityId,
      version_number:     nextNumber,
      snapshot,
      change_note:        input.changeNote ?? null,
      published_by:       user?.id ?? null,
      published_by_email: user?.email ?? null,
    })
    .select('id, version_number')
    .single()

  if (insErr) throw new Error(`publish (insert version): ${insErr.message}`)
  if (!version) throw new Error('publish: insert returned no data')

  // If republishing and the operator chose to pin existing sessions,
  // pin every session that was following current (pinned_version_id is
  // null) to the OUTGOING version, BEFORE we repoint the activity — so
  // they stop following current and stay on what they were.
  if (outgoingVersionId && input.existingSessions === 'pin') {
    const { error: pinErr } = await supabase
      .from('sessions')
      .update({ pinned_version_id: outgoingVersionId })
      .eq('operator_id', input.operatorId)
      .is('pinned_version_id', null)
      // only sessions for THIS activity — matched by activity_key, which
      // is how sessions reference their activity
      .in('activity_key', [await activityKeyFor(supabase, input.activityId)])
    if (pinErr) throw new Error(`publish (pin sessions): ${pinErr.message}`)
  }

  // Point the activity at the new version and clear the draft flag.
  const { error: updErr } = await supabase
    .from('activities')
    .update({
      current_version_id:     version.id,
      current_version_number: version.version_number,
      has_draft_changes:      false,
    })
    .eq('id', input.activityId)
  if (updErr) throw new Error(`publish (update activity): ${updErr.message}`)

  return { versionId: version.id as string, versionNumber: version.version_number as number }
}

async function activityKeyFor(supabase: ReturnType<typeof createClient>, activityId: string): Promise<string> {
  const { data } = await supabase.from('activities').select('key').eq('id', activityId).maybeSingle()
  return data?.key ?? ''
}

/**
 * Marks an activity as having unpublished draft changes. Called by
 * TemplateTab whenever a clause or question is edited, so the UI can
 * show "you have unpublished changes" and enable the Publish button
 * meaningfully.
 */
export async function markDraftChanged(activityId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('activities').update({ has_draft_changes: true }).eq('id', activityId)
  if (error) throw new Error(`mark draft changed: ${error.message}`)
}

export interface ActivityVersionState {
  currentVersionId:     string | null
  currentVersionNumber: number | null
  hasDraftChanges:      boolean
}

/**
 * Fetches just the versioning state for one activity. Kept separate from
 * fetchEngineData deliberately — that read path is shared with the
 * participant flow, and the version panel only needs these three fields,
 * so there's no reason to widen the central query.
 */
export async function fetchActivityVersionState(activityId: string): Promise<ActivityVersionState> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('activities')
    .select('current_version_id, current_version_number, has_draft_changes')
    .eq('id', activityId)
    .maybeSingle()

  if (error) throw new Error(`version state: ${error.message}`)
  return {
    currentVersionId:     data?.current_version_id ?? null,
    currentVersionNumber: data?.current_version_number ?? null,
    hasDraftChanges:      data?.has_draft_changes ?? true,
  }
}

/** Full version history for an activity, newest first. */
export async function listTemplateVersions(activityId: string): Promise<TemplateVersion[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('template_versions')
    .select('id, activity_id, version_number, snapshot, change_note, published_by_email, published_at')
    .eq('activity_id', activityId)
    .order('version_number', { ascending: false })

  if (error) throw new Error(`list versions: ${error.message}`)
  return (data ?? []).map(v => ({
    id:               v.id,
    activityId:       v.activity_id,
    versionNumber:    v.version_number,
    snapshot:         v.snapshot as TemplateSnapshot,
    changeNote:       v.change_note,
    publishedByEmail: v.published_by_email,
    publishedAt:      v.published_at,
  }))
}

/** How many signed waivers reference each version — for the history view. */
export async function signatureCountsByVersion(activityId: string): Promise<Record<string, number>> {
  const supabase = createClient()
  const { data: versions } = await supabase.from('template_versions').select('id').eq('activity_id', activityId)
  const versionIds = (versions ?? []).map(v => v.id)
  if (versionIds.length === 0) return {}

  const { data: waivers, error } = await supabase
    .from('waivers')
    .select('template_version_id')
    .in('template_version_id', versionIds)
    .not('signed_at', 'is', null)

  if (error) throw new Error(`signature counts: ${error.message}`)
  const counts: Record<string, number> = {}
  for (const w of waivers ?? []) {
    if (w.template_version_id) counts[w.template_version_id] = (counts[w.template_version_id] ?? 0) + 1
  }
  return counts
}
