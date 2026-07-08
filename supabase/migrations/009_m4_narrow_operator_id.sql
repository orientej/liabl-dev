-- Milestone 4 follow-up — narrow sessions.operator_id / notifications.operator_id
-- =================================================================
-- Completes STEP B from 007_m4_activities.sql, which deliberately widened
-- these tables (added operator_uuid alongside the old text column) rather
-- than narrowing immediately, since narrowing first required confirming
-- no application code read/wrote the old text column directly.
--
-- Audit before writing this: grepped the full app for `operator_id` /
-- `operatorId` against sessions and notifications specifically. Neither
-- table's operator_id is read or written explicitly anywhere in app code —
-- sessions are seed/manual-insert only (no runtime INSERT path), and every
-- notification-generating trigger in 006_m2_notifications.sql inserts
-- without ever naming operator_id, relying entirely on the column
-- default. That means this narrowing is safe from the application's
-- perspective, but the new uuid column needs its OWN default (pointing at
-- the same single operator the old text default pointed at) or those
-- trigger inserts would start failing NOT NULL instead of silently
-- defaulting the way they do today.
--
-- REFERENCE IMPLEMENTATION — inspect and apply manually, after 007 and
-- 008. Guarded to be safe to run more than once.

do $$
declare
  desert_ridge_id uuid;
begin
  select id into desert_ridge_id from operators where slug = 'desert-ridge';
  if desert_ridge_id is null then
    raise exception 'narrowing migration expects the desert-ridge operator row (from 007) to already exist';
  end if;

  -- ── sessions ────────────────────────────────────────────────────────
  if exists (select 1 from information_schema.columns where table_name = 'sessions' and column_name = 'operator_id' and data_type = 'text') then
    -- Safety backfill: catch any row inserted between 007's backfill and now.
    update sessions set operator_uuid = desert_ridge_id where operator_uuid is null;

    -- DDL doesn't accept a plain variable reference the way DML does —
    -- needs dynamic SQL with the value substituted as a quoted literal.
    execute format('alter table sessions alter column operator_uuid set default %L', desert_ridge_id);
    alter table sessions alter column operator_uuid set not null;
    alter table sessions drop column operator_id;
    alter table sessions rename column operator_uuid to operator_id;
    alter table sessions rename constraint sessions_operator_uuid_fkey to sessions_operator_id_fkey;
  end if;

  -- ── notifications ───────────────────────────────────────────────────
  if exists (select 1 from information_schema.columns where table_name = 'notifications' and column_name = 'operator_id' and data_type = 'text') then
    update notifications set operator_uuid = desert_ridge_id where operator_uuid is null;

    execute format('alter table notifications alter column operator_uuid set default %L', desert_ridge_id);
    alter table notifications alter column operator_uuid set not null;
    alter table notifications drop column operator_id;
    alter table notifications rename column operator_uuid to operator_id;
    alter table notifications rename constraint notifications_operator_uuid_fkey to notifications_operator_id_fkey;
  end if;
end $$;

-- Note: indexes and the FK constraint on operator_uuid (added in 007)
-- survive the rename automatically — Postgres tracks both by internal
-- attnum, not by name, so 006's operator_id indexes on `notifications`
-- and the FK reference added in 007 keep working under the new name
-- with no re-creation needed.
