-- Milestone 5 follow-up — fix notification triggers for real RLS
-- =================================================================
-- Two real bugs found by actually testing 011_m5_rls_tighten.sql against
-- simulated anon/authenticated roles, not just reading the policies:
--
-- BUG 1 (cross-tenant data leak): none of the three notification trigger
-- functions in 006_m2_notifications.sql ever explicitly set operator_id
-- on the notifications they insert — they all relied on the column's
-- DEFAULT, which 009_m4_narrow_operator_id.sql set to a single, static
-- operator id (whichever operator existed when 009 ran). Under the old
-- allow_all policy this was invisible — everyone could see every
-- notification regardless of operator_id, so a wrong value never
-- mattered functionally. Under real RLS, it meant EVERY trigger-
-- generated notification, for every operator, was defaulting to one
-- operator's id — so a second operator's own events silently generated
-- notifications visible only to the FIRST operator, not to themselves.
-- Verified with a two-operator test: operator A's authenticated view was
-- showing "Legal hold applied" notifications for both operators' incidents.
--
-- BUG 2 (broken signing flow): with notifications now RLS-protected and
-- scoped to current_operator_id(), an anonymous participant's waivers
-- insert — which fires notify_on_waiver_insert() — failed with a
-- row-level security violation, because that trigger runs as the
-- invoking role (anon) by default, and anon has no current_operator_id().
-- This would have broken live signing outright.
--
-- Fix for both: each trigger now reads operator_id directly off the row
-- that triggered it (NEW.operator_id — waivers and incidents both carry
-- this since 011) instead of leaving it to a default, and each function
-- is marked SECURITY DEFINER so it runs with the defining role's
-- privileges (bypasses RLS on notifications) regardless of who triggered
-- it. search_path is pinned per standard SECURITY DEFINER hardening
-- practice, to prevent search_path hijacking.

create or replace function notify_on_waiver_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  participant_name  text;
  activity_label    text;
  session_ref_val   text;
  monthly_count     integer;
  plan_limit        integer := 500;   -- Core tier limit; adjust when billing lands
  is_returning      boolean;
begin
  select full_name into participant_name
  from participants where id = NEW.participant_id;

  activity_label := liabl_activity_label(NEW.activity_key);

  select session_ref into session_ref_val
  from sessions where id = NEW.session_id;

  -- ── waiver_signed ─────────────────────────────────────────────────────────
  if NEW.signed_at is not null then

    select count(*) > 1 into is_returning
    from waivers
    where participant_id = NEW.participant_id
      and signed_at is not null;

    insert into notifications (operator_id, type, priority, title, body, link, link_label, waiver_id)
    values (
      NEW.operator_id,
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
      insert into notifications (operator_id, type, priority, title, body, link, link_label, waiver_id)
      values (
        NEW.operator_id,
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
    monthly_count := liabl_monthly_signature_count();
    if monthly_count = floor(plan_limit * 0.85)::integer
    or monthly_count = plan_limit then
      insert into notifications (operator_id, type, priority, title, body, link, link_label, waiver_id)
      values (
        NEW.operator_id,
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
  else
    insert into notifications (operator_id, type, priority, title, body, link, link_label, waiver_id)
    values (
      NEW.operator_id,
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
  if NEW.signed_at is not null and NEW.session_id is not null then
    if not exists (
      select 1 from waivers
      where session_id = NEW.session_id
        and signed_at is null
    ) then
      insert into notifications (operator_id, type, priority, title, body, link, link_label, waiver_id)
      values (
        NEW.operator_id,
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

create or replace function notify_on_incident_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (operator_id, type, priority, title, body, link, link_label, incident_id)
  values (
    NEW.operator_id,
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

create or replace function notify_on_incident_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.carrier_notified_at is null and NEW.carrier_notified_at is not null then
    insert into notifications (operator_id, type, priority, title, body, link, link_label, incident_id)
    values (
      NEW.operator_id,
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

-- Triggers themselves are unchanged (same function names, same firing
-- conditions) — only the function bodies above changed, via
-- create or replace function, so no drop/recreate of the triggers is
-- needed here.
