-- Sessions management — add a real date column
-- =================================================================
-- sessions had no date at all until now — just a free-text session_time
-- label ("9:00 AM") and created_at (when the row was inserted, not
-- necessarily the actual tour date). That's fine for a single-session
-- demo, but not for a real "create tomorrow's tours today, see today's
-- vs. upcoming sessions" scheduling UI.
--
-- Added alongside the existing session_time rather than replacing it —
-- session_time's free-text shape is already read elsewhere (RosterTab's
-- header badge) and there's no need to touch that working display code
-- just to add real date-based filtering/sorting.
--
-- Backfilled from created_at for existing rows so nothing goes from
-- "has a date" to "has no date" as a result of this migration.

alter table sessions
  add column if not exists session_date date;

update sessions
set session_date = created_at::date
where session_date is null;

alter table sessions
  alter column session_date set default current_date;

create index if not exists sessions_date_idx on sessions (operator_id, session_date);
