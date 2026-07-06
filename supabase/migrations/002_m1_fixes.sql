-- v23 — Milestone 1 schema migrations
-- =====================================
-- These migrations support the M1 fixes in the v23 reference implementation:
--   #3 — multi-condition health disclosure
--   #4 — DOB stored as a real date type
--
-- IMPORTANT FOR PRODUCTION:
-- This file is a REFERENCE for the production engineering work in the
-- separate production repo. Review carefully before applying. Specifically:
--   - The dob conversion uses ::date which will fail on any existing row
--     that contains a non-parseable value. Inspect existing data first.
--   - The healthStatus migration assumes the column is stored in
--     waivers.answers (jsonb) rather than as a top-level column.
--     This script does not modify jsonb contents — see notes below.

-- ─────────────────────────────────────────────────────────────
-- M1 fix #4 — DOB type
-- ─────────────────────────────────────────────────────────────
-- Convert participants.dob from text to date.
-- The frontend now produces ISO 8601 format (YYYY-MM-DD), which Postgres
-- can cast to date without ambiguity.

-- BEFORE APPLYING: inspect existing dob values to catch any non-ISO formats
-- left over from prototype testing. Example:
--   SELECT dob, count(*) FROM participants GROUP BY dob;
-- Any row that won't cast cleanly should be repaired or deleted first.

ALTER TABLE participants
  ALTER COLUMN dob TYPE date USING dob::date;


-- ─────────────────────────────────────────────────────────────
-- M1 fix #3 — multi-condition health disclosure
-- ─────────────────────────────────────────────────────────────
-- The healthStatus value lives inside waivers.answers (jsonb).
-- The application code in v23 now writes it as a JSON array
-- (e.g., ["cardiac", "injury"]) instead of a single string ("cardiac").
--
-- No schema change is strictly required because the column is jsonb,
-- but any existing waivers written by previous versions will have a
-- string value at answers->'healthStatus'. The conversion below
-- normalizes existing rows to the new array format so the dashboard
-- code can rely on a consistent shape.

UPDATE waivers
SET answers = jsonb_set(
  answers,
  '{healthStatus}',
  CASE
    -- Convert single string values to single-element arrays
    WHEN jsonb_typeof(answers->'healthStatus') = 'string' THEN
      CASE
        WHEN answers->>'healthStatus' = 'none' THEN '[]'::jsonb
        ELSE jsonb_build_array(answers->>'healthStatus')
      END
    -- Already an array — leave alone
    WHEN jsonb_typeof(answers->'healthStatus') = 'array' THEN
      answers->'healthStatus'
    -- Null or missing — set to empty array
    ELSE '[]'::jsonb
  END,
  true
)
WHERE answers ? 'healthStatus';


-- ─────────────────────────────────────────────────────────────
-- M1 fix #1 — session resolution
-- ─────────────────────────────────────────────────────────────
-- No schema change required. The sessions table already supports
-- looking up sessions by id. The application change is purely how
-- the participant flow resolves which session a waiver attaches to:
-- it now reads from the URL rather than grabbing .limit(1).single().
--
-- The operator dashboard will eventually need a way to generate
-- per-session links and QR codes. The session.session_ref column
-- already exists for human-readable references (e.g., "AM-04").
-- Production engineering should decide whether to use UUIDs in URLs
-- (longer but more secure) or session_ref (shorter, but requires
-- uniqueness constraints).


-- ─────────────────────────────────────────────────────────────
-- M1 fix #2 — silent failure path
-- ─────────────────────────────────────────────────────────────
-- No schema change required. The fix is entirely in the application
-- layer (handleSign in app/participant/page.tsx).
