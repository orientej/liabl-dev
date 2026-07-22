// lib/clause-categories.ts
// Shared clause-category vocabulary for the waiver upload/parse feature.
//
// Deliberately its own module with ZERO dependencies. Both the server-side
// segmenter (lib/clause-segment.ts, which imports the Node-only Anthropic
// SDK) and the client-side review UI need this list — importing it from
// clause-segment.ts would drag the SDK's node:fs/node:path usage into the
// browser bundle and break the build. Keeping the constant here lets both
// sides import it safely.
//
// Values match the clause keys already seeded in the product
// (007_m4_activities.sql) where they overlap. Not an enforced enum —
// there's no DB constraint on clause keys, and real uploaded waivers
// contain provisions that don't fit — so 'other' is always available and
// the operator finalizes the category during review.

export const CLAUSE_CATEGORIES = [
  'assumption',      // assumption of risk
  'release',         // release of liability / waiver of claims
  'indemnification', // hold harmless / indemnity
  'medical',         // medical treatment authorization / fitness to participate
  'emergency',       // emergency contact / authorization
  'equipment',       // equipment use / rental / return
  'governing_law',   // governing law / jurisdiction / venue
  'photo_media',     // photo / media / likeness release
  'minor',           // minor / guardian consent
  'severability',    // severability / entire agreement / misc legal
  'other',
] as const

export type ClauseCategory = typeof CLAUSE_CATEGORIES[number]
