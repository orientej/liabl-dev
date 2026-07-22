// lib/completeness-check.ts
// Waiver completeness check — compares an operator's clause set against
// components commonly found in liability waivers, and reports which are
// present, partially covered, or absent.
//
// SCOPE, and the reason it's drawn this tightly:
// This answers "does this document contain the pieces most comparable
// waivers contain?" It does NOT answer "is this waiver enforceable?" —
// enforceability turns on state law, activity type, how the document was
// presented and signed, and facts about the specific incident. An LLM
// cannot answer that, and a product that implies it can would be giving
// operators false confidence about their legal exposure while creating
// real liability for LIABL.
//
// Concretely, that means the prompt below forbids:
//   * any statement about enforceability, validity, or "holding up"
//   * any recommendation to add, remove, or reword clauses
//   * any jurisdiction-specific legal claim
// and the output is descriptive only: what's there, what isn't.
//
// Results are NOT persisted anywhere — no table, no column, no cache.
// A stored assessment becomes a discoverable record of known deficiencies
// that could be used against an operator in litigation. Running fresh on
// demand gives the same value without creating that artifact.

import Anthropic from '@anthropic-ai/sdk'
import type {
  CompletenessResult, ComponentFinding, FindingStatus, FindingImportance,
} from '@/lib/completeness-types'

export class CompletenessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompletenessError'
  }
}

export interface ClauseForCheck {
  title: string
  body:  string
}

const MODEL = 'claude-sonnet-4-6'

// The components checked for. 'core' vs 'situational' matters: a waiver
// with no photo-release clause is not deficient, it just doesn't cover
// photography. Marking those situational keeps the UI from crying wolf.
const COMPONENTS: { key: string; label: string; importance: FindingImportance; describes: string }[] = [
  { key: 'assumption_of_risk',   label: 'Assumption of risk',            importance: 'core',        describes: 'the participant acknowledges the activity carries inherent risks and accepts them' },
  { key: 'release_of_liability', label: 'Release of liability',          importance: 'core',        describes: 'the participant releases or waives claims against the operator' },
  { key: 'voluntary',            label: 'Voluntary participation',       importance: 'core',        describes: 'the participant confirms they are signing voluntarily and had a chance to read the document' },
  { key: 'medical',              label: 'Medical treatment',             importance: 'core',        describes: 'authorization to obtain emergency medical treatment, or a statement of fitness to participate' },
  { key: 'governing_law',        label: 'Governing law',                 importance: 'core',        describes: 'which state or jurisdiction\u2019s law applies' },
  { key: 'indemnification',      label: 'Indemnification / hold harmless', importance: 'core',      describes: 'the participant agrees to hold the operator harmless from third-party claims' },
  { key: 'severability',         label: 'Severability',                  importance: 'core',        describes: 'if one part of the agreement is invalid the rest still applies' },
  { key: 'minor_guardian',       label: 'Minor / guardian consent',      importance: 'situational', describes: 'a parent or guardian signing on behalf of a participant under 18' },
  { key: 'equipment',            label: 'Equipment use or rental',       importance: 'situational', describes: 'responsibility for equipment provided, rented, or damaged' },
  { key: 'photo_media',          label: 'Photo / media release',         importance: 'situational', describes: 'permission to use images or recordings of the participant' },
]

const SYSTEM_PROMPT = `You are a document completeness checker for liability waivers. You compare a waiver's contents against a fixed list of components commonly found in such documents, and report what is present and what is absent.

STRICT LIMITS on what you may say:
- NEVER assess whether the waiver is enforceable, valid, legally sufficient, or would "hold up". You cannot know this and must not imply it.
- NEVER give legal advice or recommendations. Do not write "you should add", "consider including", "this needs", or similar. Describe only what you observe.
- NEVER make jurisdiction-specific legal claims.
- NEVER describe a missing situational component as a problem or deficiency — its absence is often correct.

For each component you are given, decide:
- "present"  — the waiver clearly covers this
- "partial"  — the waiver touches on it but only in passing, or covers part of it
- "missing"  — the waiver does not appear to cover it

Write a "note" of one short, factual sentence for each: what you found, or simply that no clause addresses it. Descriptive, never advisory.

You may also return "observations": neutral, structural remarks about the document (for example, that one clause covers two unrelated topics, or that a clause appears twice). These are about document structure, not legal quality. Return an empty array if you have none.

Respond with ONLY a JSON object, no markdown fences, no preamble:
{"findings":[{"key":"...","status":"present|partial|missing","note":"..."}],"observations":["..."]}
Use exactly the component keys you are given, once each.`

export async function checkCompleteness(clauses: ClauseForCheck[]): Promise<CompletenessResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new CompletenessError('ANTHROPIC_API_KEY is not set')
  if (clauses.length === 0) throw new CompletenessError('This template has no clauses to check')

  const documentText = clauses
    .map(c => `## ${c.title}\n${c.body}`)
    .join('\n\n')

  const componentList = COMPONENTS
    .map(c => `- ${c.key} (${c.label}): ${c.describes}`)
    .join('\n')

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Components to check for:\n${componentList}\n\n---\n\nWaiver contents:\n\n${documentText}`,
      }],
    })
    raw = response.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
  } catch (err) {
    throw new CompletenessError(
      `Completeness check request failed: ${err instanceof Error ? err.message : 'unknown error'}`
    )
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new CompletenessError('The completeness check returned malformed output')
  }

  const rawFindings = (parsed as { findings?: unknown })?.findings
  if (!Array.isArray(rawFindings)) {
    throw new CompletenessError('The completeness check response was missing its findings')
  }

  // Build the result from OUR component list rather than trusting the
  // model's — so the checklist is always complete and in a stable order,
  // and a component the model forgot shows as unknown rather than
  // silently vanishing from the operator's view.
  const byKey = new Map<string, { status?: unknown; note?: unknown }>()
  for (const f of rawFindings) {
    const item = f as { key?: unknown; status?: unknown; note?: unknown }
    if (typeof item.key === 'string') byKey.set(item.key, item)
  }

  const findings: ComponentFinding[] = COMPONENTS.map(component => {
    const match = byKey.get(component.key)
    const rawStatus = typeof match?.status === 'string' ? match.status : ''
    const status: FindingStatus =
      rawStatus === 'present' || rawStatus === 'partial' || rawStatus === 'missing'
        ? rawStatus
        : 'missing'
    const note = typeof match?.note === 'string' && match.note.trim()
      ? match.note.trim()
      : match
        ? 'No detail returned for this component.'
        : 'This component was not evaluated.'
    return { key: component.key, label: component.label, importance: component.importance, status, note }
  })

  const rawObservations = (parsed as { observations?: unknown })?.observations
  const observations = Array.isArray(rawObservations)
    ? rawObservations.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map(o => o.trim())
    : []

  return { findings, observations }
}
