-- Milestone 5 — billing: per-operator signature limits, soft-block enforcement
-- =================================================================
-- Three things fixed/added here:
--
-- 1. liabl_monthly_signature_count() (006_m2_notifications.sql) counts
--    ALL operators' signed waivers combined, with no operator filter at
--    all. Invisible under single-tenant/allow_all; a real correctness bug
--    now that multiple operators exist — operator B's usage was
--    contributing to operator A's overage warnings and vice versa.
--    Parameterized to take an operator_id.
--
-- 2. The plan limit itself was a hardcoded constant (500) inside the
--    trigger function, identical for every operator with no way to
--    adjust one operator's limit without a code change. Moved to a real,
--    per-operator column (operators.plan_signature_limit) so it's
--    actually a per-operator setting, not a global constant wearing a
--    per-operator costume.
--
-- 3. The notification's own body text claimed "New signatures are
--    blocked until the limit resets or you upgrade" — false; nothing
--    enforced that. Product decision: soft block — signing continues to
--    work uninterrupted, staff get a clear, accurate alert instead of a
--    false claim of blocking. Corrected the copy to match actual
--    behavior rather than making the code match the (unreviewed) copy.

alter table operators
  add column if not exists plan_signature_limit integer not null default 500;

create or replace function liabl_monthly_signature_count(p_operator_id uuid)
returns integer language sql stable as $$
  select count(*)::integer
  from waivers
  where operator_id = p_operator_id
    and signed_at is not null
    and signed_at >= date_trunc('month', now());
$$;

create or replace function notify_on_waiver_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  participant_name  text;
  activity_label    text;
  session_ref_val   text;
  monthly_count     integer;
  plan_limit        integer;
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

    -- ── overage_warning — soft block: signing is never interrupted by this.
    -- Fire at 85% and 100% of THIS operator's own plan_signature_limit.
    select plan_signature_limit into plan_limit from operators where id = NEW.operator_id;
    monthly_count := liabl_monthly_signature_count(NEW.operator_id);
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
          || round(monthly_count::numeric / plan_limit * 100) || '%). '
          || case when monthly_count >= plan_limit
               -- Soft block: this is accurate now — signing is NOT
               -- interrupted. Say so, rather than claiming an effect
               -- that doesn't happen.
               then 'New signatures continue to be accepted while you''re over your plan limit — contact us to upgrade or add an overage block.'
               else 'Consider upgrading to Connected or purchasing an overage block before you reach your limit.'
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
