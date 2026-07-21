-- Content Management Phase 1 — Template Versioning Foundation
-- =================================================================
-- Until now, an "activity" (which functionally IS a template — it owns a
-- set of activity_clauses + activity_questions) has been a flat, mutable
-- thing: editing a clause changed it in place with no history. A signed
-- waiver snapshots its rendered clauses into waivers.clauses, so past
-- signatures were already safe from future edits — but there was no
-- concept of a NAMED, NUMBERED version a signature could point back to,
-- and no way to ask "show me everyone who signed version 3" as a real
-- query, or to diff two versions.
--
-- This migration introduces that foundation WITHOUT rewriting the
-- existing clause/question model. Operators still author clauses and
-- questions in activity_clauses/activity_questions exactly as before
-- (that's the working "draft"). Publishing captures an immutable
-- snapshot of the entire set into template_versions as structured JSONB.
--
-- Design decisions locked before building:
--   * EXPLICIT PUBLISH model — editing clauses/questions freely mutates
--     the draft; only an explicit publish bumps the version number and
--     makes a new snapshot live. (Not every-save-is-a-version.)
--   * Publishing is open to owner OR staff — no separate permission
--     column here; enforced at the app/RLS layer using the existing
--     operator_members model, same as every other operator-editable
--     thing.
--   * On republish, the operator CHOOSES per-republish whether existing
--     scheduled sessions stay pinned to their current version or move to
--     the new one — so sessions carry their own pinned_version_id rather
--     than always dereferencing the activity's current version. A typo
--     fix can move everyone forward; a substantive legal change can pin
--     existing sessions to what participants were already going to sign.

-- ─────────────────────────────────────────────────────────────
-- template_versions — immutable published snapshots
-- ─────────────────────────────────────────────────────────────
-- One row per published version of an activity's template. The snapshot
-- column holds the COMPLETE clause+question set as it existed at publish
-- time, as structured JSONB — so a version is fully self-contained and
-- reconstructable even if the live activity_clauses/activity_questions
-- rows are later edited or deleted. This is deliberately denormalized:
-- the whole point of a version is that it must never change after
-- publish, so it cannot depend on mutable rows elsewhere.

create table if not exists template_versions (
  id                uuid primary key default uuid_generate_v4(),
  operator_id       uuid not null references operators(id) on delete cascade,
  activity_id       uuid not null references activities(id) on delete cascade,
  version_number    int  not null,
  -- Full snapshot of the template at publish time. Shape:
  --   {
  --     "activity":  { display_name, icon, accent_color, base_risk_score, ... },
  --     "clauses":   [ { key, title, body_template, required, highlight, sort_order, question_key|null } ],
  --     "questions": [ { key, text, type, options, sort_order, triggers_clause, trigger_value } ]
  --   }
  -- clause.question_key references a question by a stable key WITHIN the
  -- snapshot (not a live activity_questions.id), so conditional links
  -- survive independently of the mutable tables.
  snapshot          jsonb not null,
  -- Optional operator-supplied note about what changed / why, shown in
  -- the version history view.
  change_note       text,
  published_by      uuid references auth.users(id),
  published_by_email text,
  published_at      timestamptz not null default now(),
  unique (activity_id, version_number)
);

alter table template_versions enable row level security;

create index if not exists template_versions_activity_idx
  on template_versions (activity_id, version_number desc);

-- Read scoped to the operator (same pattern as other operator-owned
-- tables); the app also reads specific versions during the participant
-- flow, which happens through the service-role/anon path already used
-- for reading published template content.
create policy "template_versions_select_own_operator" on template_versions
  for select using (operator_id = current_operator_id());

-- Inserts (publishing) go through operator-authenticated app code; any
-- member of the owning operator may publish, consistent with the
-- decision above. No update/delete policy: versions are immutable once
-- published, and history is never destroyed (rollback publishes a NEW
-- version equal to an old one, it doesn't delete anything).
create policy "template_versions_insert_own_operator" on template_versions
  for insert with check (operator_id = current_operator_id());

-- ─────────────────────────────────────────────────────────────
-- activities — draft/publish state tracking
-- ─────────────────────────────────────────────────────────────
-- current_version_id / current_version_number point at the live
-- published version (null until first publish — a brand-new activity is
-- an unpublished draft). has_draft_changes flags that the live
-- clause/question rows have been edited since the last publish, so the
-- UI can show "you have unpublished changes" and enable the publish
-- button meaningfully.

alter table activities
  add column if not exists current_version_id     uuid references template_versions(id),
  add column if not exists current_version_number int,
  add column if not exists has_draft_changes      boolean not null default true;

-- default true above: every existing activity is treated as having
-- unpublished draft changes until its first explicit publish under the
-- new model, which is accurate — none of them have a template_version
-- row yet. Their first publish becomes version 1 and captures whatever
-- their clauses/questions currently say.

-- ─────────────────────────────────────────────────────────────
-- sessions — per-session version pinning
-- ─────────────────────────────────────────────────────────────
-- A session pins the specific template version its participants will
-- sign. Null = "follow the activity's current published version"
-- (the natural default for a session created before/without an explicit
-- pin, and the behavior for activities that haven't published yet).
-- When an operator republishes and chooses "keep existing sessions on
-- the old version," those sessions get their pinned_version_id set to
-- the outgoing version so they stop following current.

alter table sessions
  add column if not exists pinned_version_id uuid references template_versions(id);

-- ─────────────────────────────────────────────────────────────
-- waivers — first-class version reference
-- ─────────────────────────────────────────────────────────────
-- The point of the whole phase: which published version was in effect
-- when this waiver was signed. waivers.clauses still holds the rendered
-- snapshot (unchanged), but template_version_id makes "who signed
-- version N" a real foreign-key query instead of a jsonb archaeology
-- exercise. Nullable because legacy signed waivers predate versioning
-- (they're the implicit "version 0 / legacy" bucket named in the
-- roadmap) and because a waiver can still be signed against an activity
-- that somehow has no published version yet (defensive).

alter table waivers
  add column if not exists template_version_id uuid references template_versions(id);

create index if not exists waivers_template_version_idx
  on waivers (template_version_id);
