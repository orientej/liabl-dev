-- Milestone 6 hotfix — operators needs a public read policy too
-- =================================================================
-- Live bug: fetchEngineData() (lib/document-engine.ts) queries the
-- operators table FIRST, before activities/sessions/clauses — as the
-- anonymous participant flow, with no auth.uid() at all. 011_m5_rls_
-- tighten.sql added public-read policies for activities, activity_
-- clauses, activity_questions, and sessions (all needed by that same
-- anonymous flow) but missed operators itself, which every one of those
-- lookups depends on resolving first. current_operator_id() correctly
-- returns null for an anonymous caller, so operators_select_own's
-- `id = current_operator_id()` never matched, and the anonymous
-- participant flow failed at the very first query with "no operator
-- found for slug" — breaking live signing entirely, not a degraded
-- experience.
--
-- This should have been caught in the original RLS testing pass — the
-- anon read checks tested activities and sessions explicitly but never
-- operators itself. Recorded here plainly rather than glossed over.
--
-- Nothing in operators is sensitive (name, slug, governing law state/
-- county, plan_signature_limit — the last being a minor internal
-- number, not something worth engineering column-level restrictions
-- around). Public read here is the same posture already applied to
-- activities/sessions/clauses for the identical reason: the anonymous
-- participant flow needs it, and none of it is health or legal data.

create policy "operators_public_read" on operators
  for select using (true);
