-- Public API — Phase D2: sandbox test-mode isolation
-- =================================================================
-- `test` API credentials (keys or OAuth clients with mode='test') create
-- data that never mixes with production. Every API-managed row carries a
-- `mode` ('live' | 'test', default 'live'), the API stamps + filters by the
-- caller's mode, and test data is excluded from the operator's live views,
-- billing counts, and staff notifications.
--
-- Propagation: the API stamps `mode` on the reservation + session it creates;
-- everything downstream inherits it automatically via BEFORE-INSERT triggers
-- (a waiver from its session, a member from its reservation, a signed
-- document from its waiver), so the participant flow — which never knew about
-- modes — needs no changes: a check-in against a test session yields a test
-- waiver.
--
-- Additive + backward compatible: existing rows all become 'live'.

-- 1) mode column on every API-managed table.
alter table reservations        add column if not exists mode text not null default 'live' check (mode in ('live','test'));
alter table sessions            add column if not exists mode text not null default 'live' check (mode in ('live','test'));
alter table reservation_members add column if not exists mode text not null default 'live' check (mode in ('live','test'));
alter table waivers             add column if not exists mode text not null default 'live' check (mode in ('live','test'));
alter table signed_documents    add column if not exists mode text not null default 'live' check (mode in ('live','test'));

-- Fast mode-scoped scans for the API list/count paths.
create index if not exists reservations_operator_mode_idx on reservations (operator_id, mode);
create index if not exists waivers_mode_idx               on waivers (mode);

-- 2) Propagation triggers. SECURITY DEFINER so the anonymous participant
--    insert (which has no RLS SELECT on sessions) can still resolve the
--    parent's mode. Each sets NEW.mode from its parent, falling back to
--    whatever was supplied (default 'live') when there is no parent.

create or replace function set_waiver_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.session_id is not null then
    NEW.mode := coalesce((select mode from sessions where id = NEW.session_id), NEW.mode);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_set_waiver_mode on waivers;
create trigger trg_set_waiver_mode before insert on waivers
  for each row execute function set_waiver_mode();

create or replace function set_member_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.reservation_id is not null then
    NEW.mode := coalesce((select mode from reservations where id = NEW.reservation_id), NEW.mode);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_set_member_mode on reservation_members;
create trigger trg_set_member_mode before insert on reservation_members
  for each row execute function set_member_mode();

create or replace function set_signed_document_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.waiver_id is not null then
    NEW.mode := coalesce((select mode from waivers where id = NEW.waiver_id), NEW.mode);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_set_signed_document_mode on signed_documents;
create trigger trg_set_signed_document_mode before insert on signed_documents
  for each row execute function set_signed_document_mode();

-- 3) Billing: sandbox signatures must NOT count toward the monthly plan.
--    Both overloads exclude test (they are called from notification/billing
--    triggers and from lib/billing).
create or replace function liabl_monthly_signature_count()
returns integer language sql stable as $$
  select count(*)::integer
  from waivers
  where signed_at is not null
    and mode <> 'test'
    and signed_at >= date_trunc('month', now());
$$;

create or replace function liabl_monthly_signature_count(p_operator_id uuid)
returns integer language sql stable as $$
  select count(*)::integer
  from waivers
  where operator_id = p_operator_id
    and signed_at is not null
    and mode <> 'test'
    and signed_at >= date_trunc('month', now());
$$;

-- 4) Notifications: a test check-in must not ping operator staff. Guard the
--    existing after-insert trigger with a WHEN clause (the BEFORE trigger
--    above has already set NEW.mode by the time this evaluates) — no change
--    to the notification function body itself.
drop trigger if exists trg_notify_waiver_insert on waivers;
create trigger trg_notify_waiver_insert
  after insert on waivers
  for each row
  when (NEW.mode is distinct from 'test')
  execute function notify_on_waiver_insert();
