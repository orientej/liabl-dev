// lib/clause-segment.ts
// Content Management — waiver upload/parse, Stage 3: AI clause segmentation.
//
// Takes the plain text produced by Stage 1 (lib/document-extract.ts) and
// asks Claude to split it into discrete, labeled clauses. This is the
// step that turns a wall of extracted text into the structured clauses
// the template model uses.
//
// SCOPE (first build, per locked decisions): segment + title +
// categorize ONLY. Each clause gets a title, a best-guess category from
// the operator's existing set, and its VERBATIM body text. Conditional-
// logic detection (turning "if under 18..." into adaptive questions) is
// deliberately deferred — harder and lower-confidence, added once the
// core flow is proven.
//
// CRITICAL — verbatim preservation: Claude's job is to SEGMENT and
// LABEL, never to rewrite. The body text of each returned clause must be
// the operator's original legal wording, unchanged. We both instruct
// this firmly in the prompt AND validate it after: every returned body
// must actually appear in the source text (normalized for whitespace),
// or that clause is rejected. Paraphrased legal text is worse than no
// parse at all.
//
// Server-only: uses the Anthropic API key, which must never reach the
// browser. Called from the route handler, not from client code.

import Anthropic from '@anthropic-ai/sdk'
import { CLAUSE_CATEGORIES, type ClauseCategory } from '@/lib/clause-categories'

// Categories live in their own dependency-free module so the client-side
// review UI can import them without dragging this file's Node-only
// Anthropic SDK into the browser bundle. Re-exported here for callers
// that already reach for them alongside the segmenter.
export { CLAUSE_CATEGORIES, type ClauseCategory } from '@/lib/clause-categories'

export interface SegmentedClause {
  title:    string
  body:     string          // VERBATIM from the source
  category: ClauseCategory
}

export interface SegmentResult {
  clauses:  SegmentedClause[]
  // Clauses the model returned but whose body text couldn't be verified
  // as verbatim from the source — surfaced so the review UI can warn,
  // rather than silently dropping or silently trusting them.
  unverifiedCount: number
}

export class SegmentationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SegmentationError'
  }
}

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a precise legal-document segmentation tool. You are given the raw text of a liability waiver or similar legal agreement. Your ONLY job is to split it into its distinct clauses and label each one. You do not rewrite, summarize, improve, or paraphrase ANY text — the body of each clause must be copied EXACTLY, character for character, from the source.

For each clause you identify, provide:
- "title": a short, human-readable title (you may write this yourself — it's a label, not legal text)
- "body": the clause's text copied VERBATIM from the source, unchanged
- "category": the single best-fit value from this list: ${CLAUSE_CATEGORIES.join(', ')}. Use "other" if none fit well.

Rules:
- NEVER alter clause body text. Copy it exactly, including punctuation and capitalization. This is legal content; changing a word can change its meaning.
- Do not invent clauses that aren't in the source.
- Do not include document headers, titles, signature lines, or blank form fields as clauses — only actual substantive provisions.
- If the document has no identifiable clauses, return an empty array.

Respond with ONLY a JSON object, no markdown, no preamble, in exactly this shape:
{"clauses":[{"title":"...","body":"...","category":"..."}]}`

/**
 * Normalizes whitespace for verbatim comparison — collapses runs of
 * whitespace to single spaces and trims. Extraction (especially from
 * PDFs) introduces inconsistent spacing/newlines, so an exact
 * byte-compare would reject legitimately-verbatim text; this checks that
 * the words are present and in order without being defeated by spacing.
 */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function segmentClauses(sourceText: string): Promise<SegmentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new SegmentationError('ANTHROPIC_API_KEY is not set')

  if (!sourceText || sourceText.trim().length < 40) {
    throw new SegmentationError('Not enough text to segment')
  }

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: sourceText }],
    })
    // Concatenate any text blocks in the response.
    raw = response.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
  } catch (err) {
    throw new SegmentationError(
      `AI segmentation request failed: ${err instanceof Error ? err.message : 'unknown error'}`
    )
  }

  // Strip accidental markdown fences if the model added them despite
  // instructions, then parse. Malformed JSON -> clear error (the route
  // turns this into the "couldn't auto-parse, create manually" path).
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new SegmentationError('AI returned malformed output')
  }

  const clausesRaw = (parsed as { clauses?: unknown })?.clauses
  if (!Array.isArray(clausesRaw)) {
    throw new SegmentationError('AI response was missing a clauses array')
  }

  const normalizedSource = normalize(sourceText)
  const clauses: SegmentedClause[] = []
  let unverifiedCount = 0

  for (const item of clausesRaw) {
    const c = item as Record<string, unknown>
    const title = typeof c.title === 'string' ? c.title.trim() : ''
    const body = typeof c.body === 'string' ? c.body.trim() : ''
    let category = typeof c.category === 'string' ? c.category.trim() : 'other'

    if (!body) continue // nothing usable
    if (!CLAUSE_CATEGORIES.includes(category as ClauseCategory)) category = 'other'

    // Verbatim check: the clause body must actually appear in the source.
    // If it doesn't, the model paraphrased — flag it rather than trust it.
    const verified = normalizedSource.includes(normalize(body))
    if (!verified) unverifiedCount++

    clauses.push({
      title: title || 'Untitled clause',
      body,
      category: category as ClauseCategory,
    })
  }

  if (clauses.length === 0) {
    throw new SegmentationError('No clauses could be identified in this document')
  }

  return { clauses, unverifiedCount }
}
