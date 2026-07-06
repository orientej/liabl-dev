# v23 — M1 Reference Implementation

This document explains the changes in v23 that address Milestone 1 of the development roadmap (`liabl-development-milestones-2026-06-23.pdf`). The changes here are a **reference implementation** in the prototype repo, intended as a starting point for the production engineering work in the separate production repo.

## Scope

v23 addresses the four Milestone 1 remaining-work items:

1. **Session resolution** — replace the `.limit(1).single()` pattern in `handleSign` with a real session-ID-from-URL lookup
2. **Silent-failure path** — replace `try/finally` with `try/catch`; failed saves no longer advance to "Waiver signed!"
3. **Multi-condition health disclosure** — `healthStatus` is now an array; participants can disclose multiple conditions
4. **DOB type** — DOB is now an ISO 8601 date string; the schema migrates from `text` to `date`

It does **not** touch any work in Milestones 2-6.

## Files Changed

### Application code
- `lib/document-engine.ts` — `HealthStatus` is now `HealthCondition[]`; `generateClauses` iterates over conditions and inserts one clause per disclosed condition. ISO date format documented for `dob`.
- `app/participant/page.tsx` — `handleSign` rewritten with proper error handling. New retryable error UI state with 3-attempt limit before escalation. Session ID is now read from URL query parameter.
- `app/participant/session/[sessionId]/page.tsx` — **NEW** dynamic route that redirects to the main participant flow with the session ID attached as a query parameter.
- `components/participant/StepHealth.tsx` — Multi-select checkbox UI with per-condition warnings; "No known conditions" as exclusive option.
- `components/participant/StepIdentity.tsx` — DOB output changed from human-readable ("January 5, 1985") to ISO 8601 ("1985-01-05") format.
- `components/RiskScore.tsx` — `calculateRiskScore` now normalizes both single-string and array shapes for `healthStatus`; supports multi-condition scoring (both cardiac AND injury can both contribute).

### Schema
- `supabase/migrations/002_m1_fixes.sql` — **NEW**. Reference SQL for the production migration:
  - `ALTER TABLE participants ALTER COLUMN dob TYPE date USING dob::date`
  - Normalize existing `waivers.answers.healthStatus` from string to array
  - No schema changes required for fixes #1 (session) or #2 (error handling)

## Design Decisions (Open to Override)

These decisions were made to keep the reference implementation moving. Your production implementation may differ.

### Session resolution — query string fallback
The main `/participant` route still works without a session ID; it falls back to a `'demo'` sentinel that resolves to the first available session. This preserves the prototype investor demo flow at `liabl-ai.vercel.app/participant`. In production, the demo sentinel should be removed and a missing session ID should redirect to a "scan the QR code at check-in" landing page.

### Session ID format — currently a UUID
The dynamic route accepts any string as `[sessionId]`. The production decision is whether to use UUIDs (longer URLs, more secure) or short human-readable refs like `AM-04` (shorter URLs, requires uniqueness constraints). The schema already has both `sessions.id` (UUID) and `sessions.session_ref` (text) columns.

### Retry count — 3 attempts before escalation
The retryable-error state allows up to 3 retry attempts before showing the fatal "find a staff member" message. This is a guess based on the audit recommendation to provide a "real error/retry state." Adjust as needed based on pilot feedback.

### Multi-condition clause ordering
When a participant discloses both cardiac and injury conditions, the cardiac clause is inserted first. This is consistent (rather than order-of-selection) so two waivers with the same disclosures produce identical clause sequences.

### Health condition values
`HealthCondition` is currently `'cardiac' | 'injury'`. The audit asked whether single-select is a real gap — the answer is yes, multi-select is the right model. New condition values can be added to the type without breaking the array shape.

## What's Intentionally NOT in v23

The following items from the roadmap are *not* addressed and remain for the production repo:

- **Real Supabase database changes** — the migration file is provided as a reference; it has not been applied to any live database.
- **Operator dashboard session-link generation** — the operator UI for generating and distributing per-session links to participants. The prototype operator dashboard still uses hardcoded session data.
- **QR code generation** — the production flow assumes the operator can produce a QR code containing a session URL. This is a small library addition not done here.
- **Anything in Milestones 2-6** — incident wiring, hash/audit trail, multi-operator schema, etc.

## Testing the Reference Implementation

To verify the changes work in the prototype:

1. **Session resolution** — visit `/participant/session/test-id-123`. You should be redirected to `/participant?session=test-id-123`. The signing flow will fail at save time because that session doesn't exist in the database — this is the *correct* behavior (no more silent success on wrong sessions).

2. **Silent failure** — disconnect from the database or use an invalid Supabase project URL. Complete the signing flow. You should see the amber retryable error panel below the signature pad with a "Try again" button, not the confirmation screen.

3. **Multi-condition** — at the Health step, select both "Cardiac" and "Recent injury". Continue to the document review. Both clauses should appear in the generated waiver.

4. **DOB** — at the Identity step, fill in DOB. Check the network tab on the signing request — the `dob` value should be `YYYY-MM-DD` format, not a human-readable string.

## Coordination Notes

This implementation does not replace your production work — it complements it. Specific items to coordinate on:

- **Session URL format** — confirm UUID vs. session_ref before the operator dashboard is built
- **Error retry policy** — confirm 3 attempts before escalation
- **Migration timing** — `dob` cast to `date` will fail if any non-parseable values exist in the production database. Inspect first.
- **Multi-condition jsonb migration** — the SQL provided handles the common cases (single string → single-element array). If there's any prototype data with unusual `healthStatus` shapes, the script may need adjustment.

If anything in here conflicts with your production architecture decisions, override freely. The point of this reference is to give you a working starting point, not to constrain your implementation.
