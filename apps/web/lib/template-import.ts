// lib/template-import.ts
// Content Management — waiver upload/parse, Stage 4: saving reviewed clauses.
//
// Takes the clauses an operator has reviewed and edited (Stage 4 UI) and
// writes them into the template model — either as a brand-new activity/
// template or appended to an existing one.
//
// Deliberately lands everything as an UNPUBLISHED DRAFT:
//   * a new activity is created with published:false (not visible to
//     participants), matching createActivity's existing behavior
//   * the target activity is marked has_draft_changes:true, so the
//     Phase 1 version panel shows "unpublished changes" and lights up
//     its Publish button
// Reviewing and going live stay two deliberate steps — the operator
// publishes v1 through the same flow they already know, rather than
// AI-parsed content silently becoming live legal text.
//
// KEY COLLISION HANDLING (the non-obvious part): both tables have
// uniqueness constraints that naive key assignment would violate.
//   * activities: unique (operator_id, key)
//   * activity_clauses: unique index on
//     (operator_id, coalesce(activity_id,…), coalesce(question_id,…), key)
// A parsed document can easily yield several clauses in the same
// category (three 'other' clauses is entirely normal), and appending to
// an existing template can collide with clauses already there. So keys
// are generated from the clause title, then de-duplicated against both
// the batch being inserted AND whatever already exists in the target.

import { createClient } from '@/lib/supabase'
import { markDraftChanged } from '@/lib/template-versions'

export interface ReviewedClause {
  title:    string
  body:     string
  category: string
}

export type ImportTarget =
  | { mode: 'new';      displayName: string }
  | { mode: 'existing'; activityId: string }

export interface ImportResult {
  activityId:    string
  activityKey:   string
  clausesAdded:  number
  createdNew:    boolean
}

/** Lowercase, underscore-separated, alphanumeric-only slug. */
function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return slug || 'clause'
}

/**
 * Returns a key not present in `taken`, appending _2, _3, … as needed.
 * Mutates `taken` so successive calls in a batch stay unique.
 */
function uniqueKey(base: string, taken: Set<string>): string {
  let candidate = base
  let n = 2
  while (taken.has(candidate)) {
    candidate = `${base}_${n}`
    n++
  }
  taken.add(candidate)
  return candidate
}

/**
 * Creates a new, empty template (activity) with a collision-safe key.
 * Exported because the setup wizard needs the same creation path for its
 * "I'll build it myself" branch — keeping the key-uniqueness logic in one
 * place rather than duplicating it and risking the two drifting apart.
 *
 * Created unpublished (published:false) — not visible to participants
 * until the operator explicitly turns it on.
 */
export async function createEmptyTemplate(
  operatorId: string,
  displayNameRaw: string,
): Promise<{ activityId: string; activityKey: string }> {
  const displayName = displayNameRaw.trim()
  if (!displayName) throw new Error('Template name is required')

  const supabase = createClient()

  // Activity keys are unique per operator — de-dupe against existing.
  const { data: existingActivities, error: listErr } = await supabase
    .from('activities')
    .select('key, sort_order')
    .eq('operator_id', operatorId)
  if (listErr) throw new Error(`read activities: ${listErr.message}`)

  const takenActivityKeys = new Set((existingActivities ?? []).map(a => a.key as string))
  const activityKey = uniqueKey(slugify(displayName), takenActivityKeys)
  const nextSortOrder = Math.max(0, ...(existingActivities ?? []).map(a => (a.sort_order as number) ?? 0)) + 1

  const { data: created, error: createErr } = await supabase
    .from('activities')
    .insert({
      operator_id:     operatorId,
      key:             activityKey,
      display_name:    displayName,
      subtitle:        null,
      icon:            'generic',
      accent_color:    '#4B2ACF',
      base_risk_score: 20,
      sort_order:      nextSortOrder,
      published:       false,
    })
    .select('id')
    .single()

  if (createErr) throw new Error(`create template: ${createErr.message}`)
  if (!created)  throw new Error('create template returned no data')

  return { activityId: created.id as string, activityKey }
}

export async function saveReviewedClauses(
  operatorId: string,
  target: ImportTarget,
  clauses: ReviewedClause[],
): Promise<ImportResult> {
  if (clauses.length === 0) throw new Error('No clauses to save')

  const supabase = createClient()
  let activityId: string
  let createdNew = false

  let activityKey: string

  if (target.mode === 'new') {
    const created = await createEmptyTemplate(operatorId, target.displayName)
    activityId  = created.activityId
    activityKey = created.activityKey
    createdNew  = true
  } else {
    activityId = target.activityId
    const { data: existing, error: keyErr } = await supabase
      .from('activities')
      .select('key')
      .eq('id', activityId)
      .maybeSingle()
    if (keyErr)   throw new Error(`read template: ${keyErr.message}`)
    if (!existing) throw new Error('Template not found')
    activityKey = existing.key as string
  }

  // Clause keys must be unique within the target activity — collect what's
  // already there (relevant when appending to an existing template) and
  // de-dupe the incoming batch against it.
  const { data: existingClauses, error: clauseErr } = await supabase
    .from('activity_clauses')
    .select('key, sort_order')
    .eq('operator_id', operatorId)
    .eq('activity_id', activityId)
  if (clauseErr) throw new Error(`read existing clauses: ${clauseErr.message}`)

  const takenClauseKeys = new Set((existingClauses ?? []).map(c => c.key as string))
  const startSortOrder = (existingClauses ?? []).length === 0
    ? 0
    : Math.max(...(existingClauses ?? []).map(c => (c.sort_order as number) ?? 0)) + 1

  const rows = clauses.map((c, i) => ({
    operator_id:   operatorId,
    activity_id:   activityId,
    question_id:   null,               // unconditional — conditional detection is deferred
    key:           uniqueKey(slugify(c.title || c.category), takenClauseKeys),
    title:         c.title.trim() || 'Untitled clause',
    body_template: c.body,             // verbatim operator/source wording, unchanged
    required:      true,
    highlight:     false,
    sort_order:    startSortOrder + i,
  }))

  const { error: insertErr } = await supabase.from('activity_clauses').insert(rows)
  if (insertErr) throw new Error(`save clauses: ${insertErr.message}`)

  // Flag the template as having unpublished changes so the version panel
  // prompts the operator to publish. Non-fatal: the clauses are already
  // saved, and a stale flag is a cosmetic problem, not a data one.
  try {
    await markDraftChanged(activityId)
  } catch (e) {
    console.error('[saveReviewedClauses] failed to mark draft changed:', e)
  }

  return { activityId, activityKey, clausesAdded: rows.length, createdNew }
}
