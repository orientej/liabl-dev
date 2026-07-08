// lib/activity-admin.ts
// v25 Milestone 4 — write operations backing TemplateTab's real authoring
// UI. Reads for this data go through fetchEngineData in document-engine.ts
// (the single source of truth for activity/question/clause shape); this
// file is just the mutations, following the same pattern as lib/incidents.ts.

import { createClient } from '@/lib/supabase'

export interface ClauseInput {
  title: string
  bodyTemplate: string
  required: boolean
  highlight: boolean
}

// ── Activities ──────────────────────────────────────────────────────────────

export interface CreateActivityInput {
  operatorId: string
  key: string
  displayName: string
  subtitle: string | null
  icon: string
  accentColor: string
  baseRiskScore: number
  sortOrder: number
}

/**
 * Creates a new activity in draft (unpublished) state. Draft activities
 * never appear to participants — only to operators authoring templates —
 * so a half-configured activity can't be picked mid-edit.
 */
export async function createActivity(input: CreateActivityInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('activities')
    .insert({
      operator_id:     input.operatorId,
      key:             input.key,
      display_name:    input.displayName,
      subtitle:        input.subtitle,
      icon:            input.icon,
      accent_color:    input.accentColor,
      base_risk_score: input.baseRiskScore,
      sort_order:      input.sortOrder,
      published:       false,
    })
    .select('id')
    .single()

  if (error) throw new Error(`create activity: ${error.message}`)
  if (!data) throw new Error('create activity returned no data')
  return data.id as string
}

export interface UpdateActivityInput {
  displayName?: string
  subtitle?: string | null
  icon?: string
  accentColor?: string
  baseRiskScore?: number
}

export async function updateActivity(activityId: string, input: UpdateActivityInput): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.displayName   !== undefined) patch.display_name    = input.displayName
  if (input.subtitle      !== undefined) patch.subtitle         = input.subtitle
  if (input.icon          !== undefined) patch.icon             = input.icon
  if (input.accentColor   !== undefined) patch.accent_color     = input.accentColor
  if (input.baseRiskScore !== undefined) patch.base_risk_score  = input.baseRiskScore

  const { error } = await supabase.from('activities').update(patch).eq('id', activityId)
  if (error) throw new Error(`update activity: ${error.message}`)
}

/** Toggles whether participants can select this activity. Preferred over
 * deleting — keeps historical waivers' activity references meaningful and
 * lets an operator pull an activity temporarily without losing its
 * question/clause configuration. */
export async function setActivityPublished(activityId: string, published: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('activities').update({ published }).eq('id', activityId)
  if (error) throw new Error(`${published ? 'publish' : 'unpublish'} activity: ${error.message}`)
}

/**
 * Hard-deletes an activity and, via the schema's ON DELETE CASCADE, its
 * activity-specific questions and clauses. Safe with respect to historical
 * data: waivers.activity_key is a text snapshot at signing time, not a
 * foreign key, so past signed waivers are unaffected either way. Prefer
 * setActivityPublished(false) when the intent is "stop offering this," and
 * reserve delete for genuine mistakes (wrong activity created, duplicate).
 */
export async function deleteActivity(activityId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('activities').delete().eq('id', activityId)
  if (error) throw new Error(`delete activity: ${error.message}`)
}

/** The one required, unconditional hazard clause for an activity
 * (activity_id set, question_id null) — the DB equivalent of the old
 * hardcoded activityClauses record. Upserts by (operator, activity, key)
 * since every activity has exactly one of these. */
export async function saveActivityHazardClause(
  operatorId: string,
  activityId: string,
  clauseKey: string,
  input: ClauseInput,
  existingClauseId: string | null
): Promise<void> {
  const supabase = createClient()
  if (existingClauseId) {
    const { error } = await supabase
      .from('activity_clauses')
      .update({ title: input.title, body_template: input.bodyTemplate, required: input.required, highlight: input.highlight })
      .eq('id', existingClauseId)
    if (error) throw new Error(`update hazard clause: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('activity_clauses')
      .insert({
        operator_id: operatorId, activity_id: activityId, question_id: null,
        key: clauseKey, title: input.title, body_template: input.bodyTemplate,
        required: input.required, highlight: input.highlight, sort_order: 7,
      })
    if (error) throw new Error(`create hazard clause: ${error.message}`)
  }
}

// ── Questions ─────────────────────────────────────────────────────────────

export interface SaveQuestionInput {
  operatorId: string
  activityId: string | null   // null = applies to all this operator's activities
  text: string
  type: 'yes_no' | 'text' | 'multiple'
  triggersClause: boolean
  triggerValue: string
  sortOrder: number
  // Only meaningful when triggersClause is true — the clause inserted into
  // the waiver when this question is answered with triggerValue.
  clause: ClauseInput | null
}

/** Creates a question and, if it triggers a clause, the linked clause in
 * the same logical operation. A "triggers a clause" question with no
 * clause attached would be a dead flag — generateClauses() would never
 * find anything to insert — so the two are kept in lockstep here rather
 * than left as two separate steps an operator could half-complete. */
export async function createQuestion(input: SaveQuestionInput): Promise<void> {
  const supabase = createClient()
  const { data: question, error: questionError } = await supabase
    .from('activity_questions')
    .insert({
      operator_id:     input.operatorId,
      activity_id:     input.activityId,
      text:            input.text,
      type:            input.type,
      sort_order:      input.sortOrder,
      triggers_clause: input.triggersClause,
      trigger_value:   input.triggerValue,
    })
    .select('id')
    .single()

  if (questionError) throw new Error(`create question: ${questionError.message}`)
  if (!question) throw new Error('create question returned no data')

  if (input.triggersClause && input.clause) {
    const clauseKey = `q_${question.id.slice(0, 8)}`
    const { error: clauseError } = await supabase
      .from('activity_clauses')
      .insert({
        operator_id: input.operatorId,
        activity_id: null,           // conditional clauses are global, keyed off the question instead
        question_id: question.id,
        key: clauseKey,
        title: input.clause.title,
        body_template: input.clause.bodyTemplate,
        required: input.clause.required,
        highlight: input.clause.highlight,
        sort_order: 4,
      })
    if (clauseError) {
      // The question was created but its clause wasn't — surface this
      // rather than leaving a silent dead "triggers a clause" flag.
      throw new Error(
        `question was created, but its clause failed to save: ${clauseError.message}. ` +
        `This question currently has no effect on generated waivers — edit it to add the clause text.`
      )
    }
  }
}

export async function updateQuestion(
  questionId: string,
  input: Omit<SaveQuestionInput, 'operatorId' | 'activityId' | 'sortOrder'>,
  existingClauseId: string | null,
  operatorId: string
): Promise<void> {
  const supabase = createClient()
  const { error: questionError } = await supabase
    .from('activity_questions')
    .update({
      text:            input.text,
      type:            input.type,
      triggers_clause: input.triggersClause,
      trigger_value:   input.triggerValue,
    })
    .eq('id', questionId)
  if (questionError) throw new Error(`update question: ${questionError.message}`)

  if (input.triggersClause && input.clause) {
    if (existingClauseId) {
      const { error } = await supabase
        .from('activity_clauses')
        .update({ title: input.clause.title, body_template: input.clause.bodyTemplate, required: input.clause.required, highlight: input.clause.highlight })
        .eq('id', existingClauseId)
      if (error) throw new Error(`update question's clause: ${error.message}`)
    } else {
      const clauseKey = `q_${questionId.slice(0, 8)}`
      const { error } = await supabase
        .from('activity_clauses')
        .insert({
          operator_id: operatorId, activity_id: null, question_id: questionId,
          key: clauseKey, title: input.clause.title, body_template: input.clause.bodyTemplate,
          required: input.clause.required, highlight: input.clause.highlight, sort_order: 4,
        })
      if (error) throw new Error(`create question's clause: ${error.message}`)
    }
  } else if (!input.triggersClause && existingClauseId) {
    // Question no longer triggers a clause — remove the now-orphaned one
    // rather than leaving a clause with no reachable trigger.
    const { error } = await supabase.from('activity_clauses').delete().eq('id', existingClauseId)
    if (error) throw new Error(`remove orphaned clause: ${error.message}`)
  }
}

/** Deletes a question. Its linked clause (if any) cascades via the schema's
 * ON DELETE CASCADE on activity_clauses.question_id. */
export async function deleteQuestion(questionId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('activity_questions').delete().eq('id', questionId)
  if (error) throw new Error(`delete question: ${error.message}`)
}
