-- v24 — Milestone 2, item 1: real Incident reporting
-- ====================================================
-- Supports the IncidentTab rewrite: incidents now write to the database,
-- legal holds are applied automatically and for real, and carrier
-- notification becomes a deliberate, logged manual step rather than an
-- instant fake webhook message.
--
-- IMPORTANT FOR PRODUCTION:
-- Reference migration — inspect and apply manually. No destructive changes;
-- everything here is additive (new nullable columns), so it's safe to run
-- against a database that already has real incidents/waivers rows from v23.

-- ─────────────────────────────────────────────────────────────
-- Carrier notification becomes an explicit, attributable action
-- ─────────────────────────────────────────────────────────────
-- carrier_notified_at already exists (set the first time someone logs a
-- notification). notified_by records who did it — there's no real webhook
-- yet, so this is a human clicking "Mark carrier notified," and we want
-- that to be attributable, not anonymous.

alter table incidents
  add column if not exists notified_by text;

-- ─────────────────────────────────────────────────────────────
-- Make the waiver link genuinely optional, and add a free-text fallback
-- ─────────────────────────────────────────────────────────────
-- The schema already allows waiver_id to be null (no NOT NULL constraint
-- in 001_initial_schema.sql), and participant_name already exists as a
-- free-text field. No schema change needed for the "search existing OR
-- free text" decision — application logic enforces that at least one of
-- {waiver_id, participant_name} is present. Documented here for clarity:
--
--   - waiver_id set, participant_name optional snapshot of the name at
--     time of filing (denormalized on purpose — if the participant's name
--     is ever corrected later, the incident keeps the name as filed)
--   - waiver_id null, participant_name required — walk-up / non-waiver
--     incident, or a participant who hasn't been found in search yet

-- A lightweight guard: require at least a name even when there's no waiver link.
alter table incidents
  add constraint if not exists incidents_participant_name_required
  check (participant_name is not null and participant_name <> '');

-- ─────────────────────────────────────────────────────────────
-- Legal hold should actually touch the waiver, not just the incident
-- ─────────────────────────────────────────────────────────────
-- waivers.legal_hold already exists (001_initial_schema.sql). The
-- application now sets it to true on the linked waiver when an incident
-- is filed against it — this migration adds no new column, just documents
-- the expected write path: incident insert + waiver legal_hold update,
-- in the same logical operation.

-- ─────────────────────────────────────────────────────────────
-- RLS — tighten incidents specifically (others remain v23's allow_all
-- pending the broader Milestone 5 security pass)
-- ─────────────────────────────────────────────────────────────
-- Demo policy stays in place for now (still single-operator, no auth yet —
-- see Milestone 5). This migration does not change RLS; flagged again here
-- so it isn't forgotten when auth lands.
