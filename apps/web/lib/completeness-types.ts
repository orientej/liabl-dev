// lib/completeness-types.ts
// Shared types for the waiver completeness check.
//
// Deliberately dependency-free so the client-side results panel can import
// these without dragging lib/completeness-check.ts's Node-only Anthropic
// SDK into the browser bundle — the same trap that broke the build when
// clause categories lived in clause-segment.ts.

export type FindingStatus = 'present' | 'partial' | 'missing'

/**
 * 'core'        — components found in most liability waivers regardless of
 *                 activity; absence is worth an operator's attention.
 * 'situational' — only relevant to some operations (equipment rental,
 *                 photography, programs involving minors). Absence is
 *                 often entirely correct, so it must not be presented as
 *                 a deficiency.
 */
export type FindingImportance = 'core' | 'situational'

export interface ComponentFinding {
  key:        string
  label:      string
  status:     FindingStatus
  importance: FindingImportance
  /** One short sentence describing what was or wasn't found. Descriptive,
   *  never advisory — no "you should add…" phrasing. */
  note:       string
}

export interface CompletenessResult {
  findings:     ComponentFinding[]
  /** Neutral observations about the document's structure — e.g. a clause
   *  covering two unrelated topics. Not legal commentary. */
  observations: string[]
}
