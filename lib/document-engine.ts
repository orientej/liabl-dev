// lib/document-engine.ts
// v25 Milestone 4 — data-driven activities, questions, and clauses.
//
// Replaces the hardcoded ActivityKey union, ACTIVITY_LABELS record,
// activityClauses record, and the fixed "State of Arizona" governing-law
// text with reads from the operators / activities / activity_questions /
// activity_clauses tables (007_m4_activities.sql).
//
// Design: data-fetching (fetchEngineData) is kept separate from the pure
// clause-assembly logic (generateClauses), so the assembly logic stays
// synchronous, testable, and unchanged in shape from before — only where
// the inputs come from has changed.
//
// One thing intentionally NOT moved into the data model: the minor/
// guardian clause. It's driven by isMinor + guardianName from the
// identity step, before any activity question is even shown — forcing it
// into activity_questions would mean faking a global "are you a minor?"
// question just to hang a clause off it. Kept special-cased here, same
// as the migration's own comment says.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityKey = string

// v23 M1 fix #3 — multi-condition health disclosure
// HealthStatus is an array; a participant can disclose multiple conditions
// (e.g., both cardiac AND injury). Empty array = no known conditions.
//
// NOTE: matching a disclosed condition to its clause currently works by
// comparing this value directly against activity_clauses.key ('cardiac' /
// 'injury') for the two seeded global health questions. That's a
// deliberate simplification for this pass, preserving today's fixed
// two-condition behavior — it doesn't yet generalize to arbitrary
// operator-authored questions the way TemplateTab's UI implies. Full
// answer-driven clause triggering (any question, any answer) is separate
// follow-on work, not required to hit this milestone's exit criteria.
export type HealthCondition = 'cardiac' | 'injury'
export type HealthStatus = HealthCondition[]

export interface ParticipantAnswers {
  fullName: string
  dob: string
  email: string
  activityKey: ActivityKey
  healthStatus: HealthStatus
  isMinor: boolean
  guardianName?: string
}

export interface WaiverClause {
  id: string; title: string; body: string; highlight?: boolean; required: boolean
}

export interface ActivityRecord {
  id:            string
  key:           string
  displayName:   string
  icon:          string
  accentColor:   string
  baseRiskScore: number
  subtitle:      string | null
  published:     boolean
}

export interface QuestionRecord {
  id:             string
  activityId:     string | null   // null = applies to all this operator's activities
  text:           string
  type:           'yes_no' | 'text' | 'multiple'
  options:        string[] | null
  sortOrder:      number
  triggersClause: boolean
  triggerValue:   string
}

// Internal raw shape — not exported, callers only see ActivityRecord /
// WaiverClause / EngineData.
interface ClauseRow {
  id: string
  activityId: string | null
  questionId: string | null
  key: string
  title: string
  bodyTemplate: string
  required: boolean
  highlight: boolean
  sortOrder: number
}

export interface EngineData {
  operatorId:          string
  operatorSlug:        string
  operatorName:        string
  governingLawState:   string
  governingLawCounty:  string | null
  activities:          ActivityRecord[]
  questions:           QuestionRecord[]
  clauses:             ClauseRow[]
}

// Fallback when there's no authenticated user to resolve an operator
// from — e.g. the participant-facing flow, which has no login concept.
// Still single-operator-shaped in that sense, same as before.
const DEFAULT_OPERATOR_SLUG = 'desert-ridge'

async function resolveOperatorSlugForCurrentUser(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('operator_members')
    .select('operators(slug)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  const operator = Array.isArray(data.operators) ? data.operators[0] : data.operators
  return operator?.slug ?? null
}

/**
 * Fetches everything needed to render the activity picker and generate
 * clauses for one operator. Call once (e.g. on flow mount) and reuse the
 * result — this data changes rarely and there's no reason to refetch it
 * per step.
 *
 * operatorSlug is optional: pass it explicitly to target a specific
 * operator, or omit it to resolve from the current authenticated user's
 * operator_members row (falling back to the single default operator if
 * there's no logged-in user — e.g. the participant flow). This means
 * dashboard call sites that already call fetchEngineData(supabase) with
 * no slug automatically respect whichever operator is actually logged
 * in, without needing to be touched themselves.
 */
export async function fetchEngineData(
  supabase: SupabaseClient,
  operatorSlug?: string,
  options: { includeUnpublished?: boolean } = {}
): Promise<EngineData> {
  const resolvedSlug = operatorSlug ?? (await resolveOperatorSlugForCurrentUser(supabase)) ?? DEFAULT_OPERATOR_SLUG

  const { data: operator, error: operatorError } = await supabase
    .from('operators')
    .select('id, slug, name, governing_law_state, governing_law_county')
    .eq('slug', resolvedSlug)
    .maybeSingle()

  if (operatorError) throw new Error(`operator lookup: ${operatorError.message}`)
  if (!operator) throw new Error(`no operator found for slug "${resolvedSlug}"`)

  let activitiesQuery = supabase
    .from('activities')
    .select('id, key, display_name, icon, accent_color, base_risk_score, subtitle, published')
    .eq('operator_id', operator.id)
    .order('sort_order')
  if (!options.includeUnpublished) {
    activitiesQuery = activitiesQuery.eq('published', true)
  }

  const [
    { data: activityRows, error: activitiesError },
    { data: clauseRows, error: clausesError },
    { data: questionRows, error: questionsError },
  ] = await Promise.all([
      activitiesQuery,
      supabase
        .from('activity_clauses')
        .select('id, activity_id, question_id, key, title, body_template, required, highlight, sort_order')
        .eq('operator_id', operator.id)
        .order('sort_order'),
      supabase
        .from('activity_questions')
        .select('id, activity_id, text, type, options, sort_order, triggers_clause, trigger_value')
        .eq('operator_id', operator.id)
        .order('sort_order'),
    ])

  if (activitiesError) throw new Error(`activities fetch: ${activitiesError.message}`)
  if (clausesError)    throw new Error(`activity_clauses fetch: ${clausesError.message}`)
  if (questionsError)  throw new Error(`activity_questions fetch: ${questionsError.message}`)

  const activities: ActivityRecord[] = (activityRows ?? []).map((r: any) => ({
    id:            r.id,
    key:           r.key,
    displayName:   r.display_name,
    icon:          r.icon,
    accentColor:   r.accent_color,
    baseRiskScore: r.base_risk_score,
    subtitle:      r.subtitle ?? null,
    published:     r.published,
  }))

  const clauses: ClauseRow[] = (clauseRows ?? []).map((r: any) => ({
    id:           r.id,
    activityId:   r.activity_id,
    questionId:   r.question_id,
    key:          r.key,
    title:        r.title,
    bodyTemplate: r.body_template,
    required:     r.required,
    highlight:    r.highlight,
    sortOrder:    r.sort_order,
  }))

  const questions: QuestionRecord[] = (questionRows ?? []).map((r: any) => ({
    id:             r.id,
    activityId:     r.activity_id,
    text:           r.text,
    type:           r.type,
    options:        r.options ?? null,
    sortOrder:      r.sort_order,
    triggersClause: r.triggers_clause,
    triggerValue:   r.trigger_value,
  }))

  return {
    operatorId:         operator.id,
    operatorSlug:       operator.slug,
    operatorName:       operator.name,
    governingLawState:  operator.governing_law_state,
    governingLawCounty: operator.governing_law_county ?? null,
    activities,
    questions,
    clauses,
  }
}

/** Builds a { key: displayName } map — the same shape ACTIVITY_LABELS used
 * to be, for components that just want display copy and don't need the
 * full ActivityRecord (StepDocument, StepConfirm, StepHealth). */
export function buildActivityLabels(data: EngineData): Record<string, string> {
  return Object.fromEntries(data.activities.map(a => [a.key, a.displayName]))
}

/** Single-lookup convenience for components that only hold an
 * ActivityRecord[] (not full EngineData) — e.g. IncidentTab, analytics.ts. */
export function activityLabel(activities: ActivityRecord[], key: string): string {
  return activities.find(a => a.key === key)?.displayName ?? key
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? '')
}

export function generateClauses(data: EngineData, answers: ParticipantAnswers): WaiverClause[] {
  const activity = data.activities.find(a => a.key === answers.activityKey)
  if (!activity) {
    // Fail loud rather than silently rendering a waiver against the wrong
    // (or no) activity — same "throw a specific message" philosophy as
    // the M1 session-resolution fix.
    throw new Error(`generateClauses: no activity found for key "${answers.activityKey}"`)
  }

  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const vars: Record<string, string> = {
    name:                 answers.fullName,
    activity:             activity.displayName,
    date,
    governing_law_state:  data.governingLawState,
    governing_law_county: data.governingLawCounty ?? '',
  }

  const applicable = data.clauses.filter(c => {
    if (c.activityId !== null && c.activityId !== activity.id) return false        // belongs to a different activity
    if (c.questionId !== null && !answers.healthStatus?.includes(c.key as HealthCondition)) return false // conditional, not triggered
    return true
  })

  const clauses: WaiverClause[] = applicable
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => ({
      id:        c.key,
      title:     c.title,
      body:      renderTemplate(c.bodyTemplate, vars),
      required:  c.required,
      highlight: c.highlight,
    }))

  if (answers.isMinor && answers.guardianName) {
    clauses.push({
      id: 'minor', title: 'Guardian Authorization', highlight: true, required: true,
      body: `${answers.guardianName} grants permission for minor ${answers.fullName} to participate and agrees to all terms of this waiver on their behalf.`,
    })
  }

  return clauses
}
