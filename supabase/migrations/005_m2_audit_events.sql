-- v24 M2 item 4 — audit_events table
-- =====================================
-- Stores real, timestamped events from the participant signing flow.
-- Replaces the four hardcoded lines in WaiverDetail's fake audit trail.
--
-- Design decisions:
-- - session_id and waiver_id are both nullable so pre-signing events
--   (session.started, document.viewed) can be logged before a waiver
--   row exists. waiver.signed and document.sealed always have both.
-- - event_type is a free-text label (not an enum) so new event types
--   can be added without a schema migration.
-- - metadata is jsonb for flexible per-event context (clause count,
--   activity key, hash snippet, etc.) without new columns per event.
-- - ip_address is duplicated from waivers for pre-signing events where
--   no waiver row exists yet. For post-signing events it should match
--   waivers.ip_address.
-- - created_at is the authoritative event timestamp — use this, not
--   any timestamp embedded in metadata.
--
-- REFERENCE IMPLEMENTATION — inspect before applying to any live database.

create table if not exists audit_events (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid references sessions(id)  on delete set null,
  waiver_id    uuid references waivers(id)   on delete set null,
  event_type   text not null,
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz default now()
);

-- Fast lookups from WaiverDetail (all events for a waiver) and from
-- the session manifest (all events for a session today)
create index if not exists audit_events_waiver_idx  on audit_events (waiver_id)  where waiver_id  is not null;
create index if not exists audit_events_session_idx on audit_events (session_id) where session_id is not null;
create index if not exists audit_events_created_idx on audit_events (created_at desc);

-- RLS — allow_all consistent with other tables pending M5 auth pass
alter table audit_events enable row level security;
create policy "allow_all_audit_events" on audit_events
  for all using (true) with check (true);

-- ── Event type reference ──────────────────────────────────────────────────────
-- Documenting the event types the application currently emits.
-- New types can be added at any time without schema changes.
--
--   session.started     — participant flow mounted, session resolved
--   waiver.generated    — generateClauses() ran, adaptive doc assembled
--   document.viewed     — participant clicked through to StepDocument
--   waiver.signed       — waiver row inserted, signature captured
--   document.sealed     — SHA-256 hash computed, PDF uploaded
