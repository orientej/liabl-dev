-- Session archiving
-- =================================================================
-- Operators accumulate sessions fast (one per group or time slot), and
-- old ones clutter every place sessions are listed. Archiving hides a
-- session without deleting it — deleteSession() already exists for
-- genuine removal, but that destroys the record, which is the wrong tool
-- for "this is finished, get it out of my way."
--
-- archived_at doubles as the flag and the audit of when it happened.
-- NULL = active.
--
-- Behavior this enables (decisions locked before building):
--   * Archived sessions are hidden from the Sessions list by default,
--     behind a "show archived" toggle.
--   * Waivers signed under an archived session are hidden from the
--     roster's default "All participants" view — but remain reachable
--     by selecting that archived session explicitly in the roster's
--     session filter, so signed legal records never become unreachable.
--   * An archived session STOPS accepting new signatures — its check-in
--     link and QR code no longer work. Archiving means finished.
--
-- Nothing is deleted and no existing row changes meaning: every current
-- session is active (archived_at NULL) until an operator archives it.

alter table sessions
  add column if not exists archived_at timestamptz;

-- Partial index: the common query is "active sessions for this operator",
-- and indexing only the active rows keeps it small as archived sessions
-- accumulate over time.
create index if not exists sessions_active_idx
  on sessions (operator_id)
  where archived_at is null;
