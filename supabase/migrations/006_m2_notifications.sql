-- v24 M2 item 5 — notifications table + auto-generation triggers
-- =================================================================
-- Notifications are generated server-side by Postgres triggers rather
-- than by application code. This means they're created reliably even if
-- the client disconnects mid-flow, and they don't require a separate
-- application-layer fan-out step.
--
-- Three trigger sources:
--   1. waivers     — waiver_signed, exception_flagged, group_complete,
--                    pass_recognized, overage_warning
--   2. incidents   — legal_hold (on insert), carrier_notified (on update)
--   3. (future)    — session.started from audit_events if needed
--
-- REFERENCE IMPLEMENTATION — inspect and apply manually.
-- Safe to run on a database with existing data; triggers only fire on
-- future inserts/updates. Backfilling historical notifications is not
-- included — the feed starts from when this migration is applied.

-- ── notifications table ───────────────────────────────────────────────────────

create table if not exists notifications (
  id           uuid primary key default uuid_generate_v4(),
  operator_id  text not null default 'desert-ridge',  -- tightened in M5 auth pass
  type         text not null,
  priority     text not null default 'normal'
                check (priority in ('high', 'normal', 'low')),
  title        text not null,
  body         text not null,
  link         text,
  link_label   text,
  read         boolean not null default false,
  -- Source references — at most one will be set per notification
  waiver_id    uuid references waivers(id)   on delete set null,
  incident_id  uuid references incidents(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_operator_created_idx
  on notifications (operator_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (operator_id, read)
  where read = false;

alter table notifications enable row level security;
create policy "allow_all_notifications" on notifications
  for all using (true) with check (true);

-- ── Helper: get activity label ────────────────────────────────────────────────

create or replace function liabl_activity_label(activity_key text)
returns text language sql immutable as $$
  select case activity_key
    when 'kayak' then 'Whitewater Kayaking'
    when 'hike'  then 'Canyon Hiking'
    when 'atv'   then 'ATV Tour'
    when 'climb' then 'Rock Climbing'
    else initcap(activity_key)
  end;
$$;

-- ── Helper: monthly signature count ──────────────────────────────────────────

create or replace function liabl_monthly_signature_count()
returns integer language sql stable as $$
  select count(*)::integer
  from waivers
  where signed_at is not null
    and signed_at >= date_trunc('month', now());
$$;

-- ── Trigger 1: waivers — on INSERT ───────────────────────────────────────────

create or replace function notify_on_waiver_insert()
returns trigger language plpgsql as $$
declare
  participant_name  text;
  activity_label    text;
  session_ref_val   text;
  monthly_count     integer;
  plan_limit        integer := 500;   -- Core tier limit; adjust when billing lands
  is_returning      boolean;
begin
  -- Resolve participant name
  select full_name into participant_name
  from participants where id = NEW.participant_id;

  activity_label := liabl_activity_label(NEW.activity_key);

  -- Resolve session ref for display
  select session_ref into session_ref_val
  from sessions where id = NEW.session_id;

  -- ── waiver_signed ─────────────────────────────────────────────────────────
  if NEW.signed_at is not null then

    -- Check if returning participant (same participant_id, >1 signed waiver)
    select count(*) > 1 into is_returning
    from waivers
    where participant_id = NEW.participant_id
      and signed_at is not null;

    -- Notification body includes risk level if available
    insert into notifications (type, priority, title, body, link, link_label, waiver_id)
    values (
      'waiver_signed',
      'normal',
      'New waiver signed',
      coalesce(participant_name, 'Unknown participant') || ' signed their '
        || activity_label || ' waiver.'
        || case when NEW.risk_level is not null
             then ' Risk: ' || initcap(NEW.risk_level) || ' (' || coalesce(NEW.risk_score::text, '—') || ').'
             else '' end
        || case when session_ref_val is not null
             then ' Session ' || session_ref_val || '.'
             else '' end,
      '/operator',
      'View roster',
      NEW.id
    );

    -- ── pass_recognized ───────────────────────────────────────────────────
    if is_returning then
      insert into notifications (type, priority, title, body, link, link_label, waiver_id)
      values (
        'pass_recognized',
        'low',
        'Returning participant — ' || coalesce(participant_name, 'Unknown'),
        coalesce(participant_name, 'Unknown participant')
          || ' has signed with this operator before. Check-in may be faster with their previous waiver on file.',
        '/operator',
        'View roster',
        NEW.id
      );
    end if;

    -- ── overage_warning ───────────────────────────────────────────────────
    -- Fire at 85% and 100% of monthly plan limit
    monthly_count := liabl_monthly_signature_count();
    if monthly_count = floor(plan_limit * 0.85)::integer
    or monthly_count = plan_limit then
      insert into notifications (type, priority, title, body, link, link_label, waiver_id)
      values (
        'overage_warning',
        'high',
        case when monthly_count >= plan_limit
          then 'Monthly signature limit reached'
          else 'Approaching monthly signature limit'
        end,
        'You have used ' || monthly_count || ' of your ' || plan_limit
          || ' monthly signatures ('
          || round(monthly_count::numeric / plan_limit * 100) || '%).'
          || case when monthly_count >= plan_limit
               then ' New signatures are blocked until the limit resets or you upgrade.'
               else ' Consider upgrading to Connected or purchasing an overage block.'
             end,
        '/pricing',
        'View options',
        NEW.id
      );
    end if;

  -- ── exception_flagged — unsigned waiver inserted (pending) ────────────────
  -- A waiver row with no signed_at means a participant was added to the
  -- session roster but hasn't completed signing yet.
  else
    insert into notifications (type, priority, title, body, link, link_label, waiver_id)
    values (
      'exception_flagged',
      'high',
      'Participant added — signature pending',
      coalesce(participant_name, 'Unknown participant')
        || ' has been added to the ' || activity_label || ' roster'
        || case when session_ref_val is not null then ' (Session ' || session_ref_val || ')' else '' end
        || ' but has not yet signed their waiver.',
      '/operator',
      'View roster',
      NEW.id
    );
  end if;

  -- ── group_complete ────────────────────────────────────────────────────────
  -- Check if every waiver in this session is now signed
  if NEW.signed_at is not null and NEW.session_id is not null then
    if not exists (
      select 1 from waivers
      where session_id = NEW.session_id
        and signed_at is null
    ) then
      insert into notifications (type, priority, title, body, link, link_label, waiver_id)
      values (
        'group_complete',
        'normal',
        'Session fully signed'
          || case when session_ref_val is not null then ' — ' || session_ref_val else '' end,
        'All participants in the '
          || case when session_ref_val is not null then session_ref_val || ' ' else '' end
          || activity_label || ' session have completed their waivers. Session is clear to proceed.',
        '/operator',
        'View roster',
        NEW.id
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_waiver_insert on waivers;
create trigger trg_notify_waiver_insert
  after insert on waivers
  for each row execute function notify_on_waiver_insert();

-- ── Trigger 2: incidents — on INSERT (legal_hold) ────────────────────────────

create or replace function notify_on_incident_insert()
returns trigger language plpgsql as $$
begin
  insert into notifications (type, priority, title, body, link, link_label, incident_id)
  values (
    'legal_hold',
    'high',
    'Legal hold applied — ' || NEW.ref,
    'A legal hold has been applied to '
      || coalesce(NEW.participant_name, 'Unknown participant') || '''s '
      || coalesce(liabl_activity_label(NEW.activity), NEW.activity, 'activity')
      || ' waiver following incident ' || NEW.ref || '. Document retention timer suspended.',
    '/operator',
    'View incident',
    NEW.id
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_incident_insert on incidents;
create trigger trg_notify_incident_insert
  after insert on incidents
  for each row execute function notify_on_incident_insert();

-- ── Trigger 3: incidents — on UPDATE (carrier_notified) ──────────────────────

create or replace function notify_on_incident_update()
returns trigger language plpgsql as $$
begin
  -- Only fire when carrier_notified_at transitions from null → a value
  if OLD.carrier_notified_at is null and NEW.carrier_notified_at is not null then
    insert into notifications (type, priority, title, body, link, link_label, incident_id)
    values (
      'carrier_notified',
      'normal',
      'Carrier notified — ' || NEW.ref,
      coalesce(NEW.notified_by, 'Staff') || ' confirmed that the insurance carrier was notified'
        || ' regarding incident ' || NEW.ref
        || ' (' || coalesce(NEW.participant_name, 'Unknown') || '). '
        || 'Logged at ' || to_char(NEW.carrier_notified_at at time zone 'UTC', 'HH24:MI UTC') || '.',
      '/operator',
      'View incident',
      NEW.id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_incident_update on incidents;
create trigger trg_notify_incident_update
  after update on incidents
  for each row execute function notify_on_incident_update();
