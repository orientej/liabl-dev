-- Milestone 5 — real RLS, replacing every allow_all policy
-- =================================================================
-- Read this before applying: this migration changes what queries can
-- return, not just what's allowed in principle. Two categories of access
-- exist in this app and must both keep working:
--   (a) authenticated operator staff, via operator_members -> operators
--   (b) anonymous participants filling out a waiver — no login at all,
--       resolved instead by session_id/QR code, not auth.uid()
-- Every policy below is designed against both, not just (a). Getting (b)
-- wrong breaks live signing, not just an admin view.
--
-- Three tables (waivers, incidents, audit_events) get a new, denormalized
-- operator_id column rather than relying on multi-hop join policies —
-- simpler to reason about and materially faster at scale. participants is
-- deliberately NOT given one — see the note above that table below.
--
-- REFERENCE IMPLEMENTATION — inspect before applying. Requires app code
-- changes alongside this (waivers insert must supply operator_id and stop
-- relying on .select() after insert; incidents/audit_events inserts must
-- supply operator_id) — this migration and those changes ship together,
-- not independently.

-- ─────────────────────────────────────────────────────────────
-- Helper: resolves the operator_id of the currently authenticated user.
-- Returns null for anonymous requests (participants) and for logged-in
-- users who haven't completed org setup yet — both are meaningful
-- "no operator" states, not errors.
--
-- Not security definer: it queries operator_members as the calling user,
-- under that table's OWN RLS policy below (user_id = auth.uid()) — which
-- is exactly the row this function wants to read anyway, so there's no
-- circularity and no need to bypass RLS.
-- ─────────────────────────────────────────────────────────────

create or replace function current_operator_id() returns uuid
language sql stable
as $$
  select operator_id from operator_members where user_id = auth.uid() limit 1
$$;

-- ─────────────────────────────────────────────────────────────
-- New operator_id columns + backfill
-- ─────────────────────────────────────────────────────────────

do $$
declare
  desert_ridge_id uuid;
begin
  select id into desert_ridge_id from operators where slug = 'desert-ridge';

  -- waivers: resolve via session_id -> sessions.operator_id where
  -- possible; anything left over is pre-existing single-tenant data.
  if not exists (select 1 from information_schema.columns where table_name = 'waivers' and column_name = 'operator_id') then
    alter table waivers add column operator_id uuid references operators(id);

    update waivers w
    set operator_id = s.operator_id
    from sessions s
    where w.session_id = s.id and w.operator_id is null;

    if desert_ridge_id is not null then
      update waivers set operator_id = desert_ridge_id where operator_id is null;
    end if;

    alter table waivers alter column operator_id set not null;
    create index if not exists waivers_operator_idx on waivers (operator_id);
  end if;

  -- incidents: resolve via waiver_id -> waivers.operator_id (now
  -- populated above) where possible; free-text incidents with no waiver
  -- link have no chain to follow, so they get the same legacy default.
  if not exists (select 1 from information_schema.columns where table_name = 'incidents' and column_name = 'operator_id') then
    alter table incidents add column operator_id uuid references operators(id);

    update incidents i
    set operator_id = w.operator_id
    from waivers w
    where i.waiver_id = w.id and i.operator_id is null;

    if desert_ridge_id is not null then
      update incidents set operator_id = desert_ridge_id where operator_id is null;
    end if;

    alter table incidents alter column operator_id set not null;
    create index if not exists incidents_operator_idx on incidents (operator_id);
  end if;

  -- audit_events: deliberately left NULLABLE. The very first event of a
  -- participant's flow (session.started) fires before the operator's
  -- activities/session data has even loaded — there is no operator to
  -- attach at that moment, by design (see ParticipantFlow.tsx's mount
  -- effect, which fires this event in parallel with, not after, engine
  -- data loading). A handful of pre-resolution rows having no operator
  -- is an accepted, documented gap, not an oversight.
  if not exists (select 1 from information_schema.columns where table_name = 'audit_events' and column_name = 'operator_id') then
    alter table audit_events add column operator_id uuid references operators(id);

    update audit_events a
    set operator_id = coalesce(
      (select s.operator_id from sessions s where s.id = a.session_id),
      (select w.operator_id from waivers  w where w.id = a.waiver_id)
    )
    where a.operator_id is null;

    create index if not exists audit_events_operator_idx on audit_events (operator_id) where operator_id is not null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Drop every allow_all policy
-- ─────────────────────────────────────────────────────────────

drop policy if exists "allow_all_participants"       on participants;
drop policy if exists "allow_all_sessions"            on sessions;
drop policy if exists "allow_all_waivers"              on waivers;
drop policy if exists "allow_all_incidents"            on incidents;
drop policy if exists "allow_all_audit_events"         on audit_events;
drop policy if exists "allow_all_notifications"        on notifications;
drop policy if exists "allow_all_operators"            on operators;
drop policy if exists "allow_all_activities"           on activities;
drop policy if exists "allow_all_activity_questions"   on activity_questions;
drop policy if exists "allow_all_activity_clauses"     on activity_clauses;
drop policy if exists "allow_all_operator_members"     on operator_members;

-- ─────────────────────────────────────────────────────────────
-- operators
-- Anyone authenticated can create one (self-serve signup) — there's no
-- operator_id to scope INSERT against yet at that moment. Everything
-- else is scoped to your own operator.
-- ─────────────────────────────────────────────────────────────

create policy "operators_select_own" on operators
  for select using (id = current_operator_id());
create policy "operators_insert_signup" on operators
  for insert with check (auth.role() = 'authenticated');
create policy "operators_update_own" on operators
  for update using (id = current_operator_id()) with check (id = current_operator_id());

-- ─────────────────────────────────────────────────────────────
-- operator_members
-- Keyed directly on auth.uid(), not on current_operator_id() — this is
-- the table current_operator_id() itself reads, so it stays independent
-- of that helper to avoid circularity. No update/delete policy yet:
-- there's no team-management UI to remove/change a member's role, so
-- there's nothing to safely allow here yet.
-- ─────────────────────────────────────────────────────────────

create policy "operator_members_select_own" on operator_members
  for select using (user_id = auth.uid());
create policy "operator_members_insert_self" on operator_members
  for insert with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- activities / activity_questions / activity_clauses
-- Operator staff get full access to their own rows, including drafts.
-- The public policy is separate and additive (Postgres OR's multiple
-- permissive policies together) — participants filling out a waiver
-- have no auth.uid() at all, and need to read published activities and
-- their clauses/questions regardless of which operator they belong to
-- (that's resolved by the session/QR code, not by who's logged in).
-- ─────────────────────────────────────────────────────────────

create policy "activities_manage_own" on activities
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "activities_public_read_published" on activities
  for select using (published = true);

create policy "activity_questions_manage_own" on activity_questions
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "activity_questions_public_read" on activity_questions
  for select using (true);

create policy "activity_clauses_manage_own" on activity_clauses
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "activity_clauses_public_read" on activity_clauses
  for select using (true);

-- ─────────────────────────────────────────────────────────────
-- sessions
-- Same pattern: operators manage their own, participants need to read
-- any session to resolve which one they're checking into.
-- ─────────────────────────────────────────────────────────────

create policy "sessions_manage_own" on sessions
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "sessions_public_read" on sessions
  for select using (true);

-- ─────────────────────────────────────────────────────────────
-- waivers — the actual health/legal data. Operator staff see only their
-- own operator's waivers. Participants can INSERT (signing) and UPDATE
-- (the post-seal hash/pdf_url writeback) but deliberately have NO select
-- policy — see the app-code note at the top of this file: the insert
-- path now generates its own UUID client-side and doesn't read the row
-- back, specifically so this table never needs a public-read policy.
-- No delete policy for anyone — signed legal documents aren't erasable
-- through the app layer.
-- ─────────────────────────────────────────────────────────────

create policy "waivers_select_own_operator" on waivers
  for select using (operator_id = current_operator_id());
create policy "waivers_public_insert" on waivers
  for insert with check (true);
-- Two separate UPDATE policies, not one broad one: Postgres RLS
-- permissive policies are OR'd together, so a single "using (true)"
-- policy would let an AUTHENTICATED user from a different operator
-- update any other operator's waiver rows too (e.g. tampering with a
-- legal hold via lib/incidents.ts) — adding a stricter policy alongside
-- it would not fix that, since the broad one still passes. Scoping the
-- anonymous-writeback policy to auth.role() = 'anon' closes that off:
-- logged-in staff can ONLY update via the operator-scoped policy below.
-- The remaining gap — an anonymous request forging a hash/pdf_url on a
-- waiver it doesn't own, given no participant-side identity exists to
-- check against — is a real, pre-existing limitation (true under the
-- old allow_all policy too, not a regression), and would need a
-- service-role-only write path to close properly; noted as follow-up.
create policy "waivers_update_own_operator" on waivers
  for update using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "waivers_anon_seal_writeback" on waivers
  for update using (auth.role() = 'anon') with check (auth.role() = 'anon');

-- ─────────────────────────────────────────────────────────────
-- incidents — operator-staff only, no participant access at all.
-- ─────────────────────────────────────────────────────────────

create policy "incidents_manage_own" on incidents
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

-- ─────────────────────────────────────────────────────────────
-- audit_events — participants write (fire-and-forget, no read-back —
-- logEvent() never calls .select()), operator staff read their own.
-- Rows with a null operator_id (the pre-resolution session.started
-- event) are simply invisible to everyone via this policy — an accepted
-- gap, not a bug; see the backfill comment above.
-- ─────────────────────────────────────────────────────────────

create policy "audit_events_select_own_operator" on audit_events
  for select using (operator_id = current_operator_id());
create policy "audit_events_public_insert" on audit_events
  for insert with check (true);

-- ─────────────────────────────────────────────────────────────
-- notifications — operator-staff only, generated by DB triggers (which
-- run as the defining role and aren't subject to RLS the way client
-- queries are, so trigger-generated inserts are unaffected by this).
-- ─────────────────────────────────────────────────────────────

create policy "notifications_manage_own" on notifications
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

-- ─────────────────────────────────────────────────────────────
-- participants — deliberately NOT operator-scoped by a column. email is
-- globally unique with an upsert-on-signing pattern: the same person
-- signing at two different operators intentionally reuses one row. This
-- is the seed of the cross-operator "LIABL Pass" identity feature the
-- roadmap explicitly defers to V2 — adding a single operator_id column
-- here would either break that intentional sharing or require building
-- the real many-to-many identity model early. Neither is right for this
-- pass.
--
-- Instead: operator staff can see a participant's record only if that
-- participant has signed at least one waiver with THEIR operator (via
-- the waivers.operator_id column above) — not full visibility into
-- every participant in the system. Participants themselves (anonymous)
-- can INSERT/UPDATE/SELECT their own record freely, same as today —
-- there's no participant-side identity to scope this by without a
-- separate participant auth system, which is out of scope here. This is
-- a real, documented limitation: participants' name/email/dob (not
-- their health answers, which live in waivers.answers and ARE properly
-- scoped) is not meaningfully access-controlled in this pass.
-- ─────────────────────────────────────────────────────────────

create policy "participants_select_via_own_waivers" on participants
  for select using (
    exists (select 1 from waivers w where w.participant_id = participants.id and w.operator_id = current_operator_id())
    or auth.role() <> 'authenticated'
  );
create policy "participants_public_insert" on participants
  for insert with check (auth.role() = 'anon');
create policy "participants_public_update" on participants
  for update using (auth.role() = 'anon') with check (auth.role() = 'anon');

-- ─────────────────────────────────────────────────────────────
-- Storage: waivers bucket
-- 004_m2_hashing.sql's own commented-out example assumed "authenticated
-- users" would be the ones uploading — tracing the actual code path
-- (lib/seal.ts's uploadPdf, called from ParticipantFlow.tsx) shows the
-- upload happens during the anonymous participant signing flow, not by
-- logged-in operator staff. Policy corrected accordingly. SELECT is
-- needed too — createSignedUrl (called immediately after upload, same
-- anonymous request) requires read access to generate a signed URL.
-- Still no update or delete policy — sealed PDFs remain unoverwritable
-- and undeletable through the API, matching seal.ts's own upsert:false.
-- ─────────────────────────────────────────────────────────────

create policy "waivers_bucket_insert" on storage.objects
  for insert with check (bucket_id = 'waivers');
create policy "waivers_bucket_select" on storage.objects
  for select using (bucket_id = 'waivers');
