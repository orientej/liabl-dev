-- Milestone 4 — data-driven activities, questions, and clauses
-- =================================================================
-- Replaces the hardcoded ActivityKey union, activityClauses record, and
-- baseClauses() Arizona/Maricopa text in lib/document-engine.ts — plus the
-- five other places that independently hardcoded the same activity list
-- (StepActivity.tsx, RosterTab.tsx, IncidentTab.tsx, analytics.ts,
-- RiskScore.tsx's activityRisk map).
--
-- Modeled on TemplateTab.tsx's question-set shape (chosen over the
-- simpler "one clause per activity" model so we don't need a second
-- migration when TemplateTab gets wired up for real) rather than on the
-- current engine's flatter shape.
--
-- REFERENCE IMPLEMENTATION — inspect and apply manually, in order after
-- 001-006. Additive only: no existing column is dropped or renamed in
-- this migration. The operator_id-as-proper-FK exit criterion is done in
-- two steps (widen now, narrow later) — see the bottom section — because
-- narrowing requires application code to be updated first.

-- ─────────────────────────────────────────────────────────────
-- operators — didn't exist before this. Unblocks the operator-name
-- fix in PageNav (currently hardcoded "Desert Ridge Adventures") and
-- makes governing law a per-operator setting instead of fixed text
-- inside every waiver's Governing Law clause.
-- ─────────────────────────────────────────────────────────────

create table if not exists operators (
  id                   uuid primary key default uuid_generate_v4(),
  slug                 text unique not null,   -- replaces the free-floating 'desert-ridge' string
  name                 text not null,
  governing_law_state  text not null,
  governing_law_county text,
  created_at           timestamptz not null default now()
);

alter table operators enable row level security;
create policy "allow_all_operators" on operators
  for all using (true) with check (true);
-- Demo policy — real per-operator isolation is Milestone 5, same as every
-- other allow_all policy in this schema (001/003/006 all flag the same).

-- ─────────────────────────────────────────────────────────────
-- activities — replaces the ActivityKey union type. Adding a new
-- activity becomes an insert, not a code change + redeploy.
-- ─────────────────────────────────────────────────────────────

create table if not exists activities (
  id              uuid primary key default uuid_generate_v4(),
  operator_id     uuid not null references operators(id) on delete cascade,
  key             text not null,          -- short slug, e.g. 'kayak' — kept for URL/display continuity
  display_name    text not null,
  icon            text not null,          -- name looked up against a fixed icon-component map in code, not a DB-rendered icon
  accent_color    text not null,          -- hex, e.g. '#4B2ACF'
  base_risk_score int not null default 20, -- replaces RiskScore.tsx's hardcoded activityRisk map
  published       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (operator_id, key)
);

alter table activities enable row level security;
create policy "allow_all_activities" on activities
  for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- activity_questions — TemplateTab's question-set model made real.
-- activity_id nullable = applies across ALL of this operator's
-- activities (this is how the cardiac/injury health questions stay
-- activity-agnostic, matching current engine behavior where those
-- conditions apply regardless of which activity was picked).
-- ─────────────────────────────────────────────────────────────

create table if not exists activity_questions (
  id              uuid primary key default uuid_generate_v4(),
  operator_id     uuid not null references operators(id)  on delete cascade,
  activity_id     uuid references activities(id) on delete cascade, -- null = global
  text            text not null,
  type            text not null check (type in ('yes_no', 'text', 'multiple')),
  options         jsonb,                  -- used when type = 'multiple'
  sort_order      int not null default 0,
  triggers_clause boolean not null default false,
  trigger_value   text not null default 'yes', -- the answer that fires the linked clause
  created_at      timestamptz not null default now()
);

alter table activity_questions enable row level security;
create policy "allow_all_activity_questions" on activity_questions
  for all using (true) with check (true);

create index if not exists activity_questions_operator_idx
  on activity_questions (operator_id, activity_id);

-- Plain unique(operator_id, activity_id, text) wouldn't actually dedupe the
-- global (activity_id null) rows this seed inserts, since Postgres treats
-- NULL as distinct from NULL for uniqueness purposes. Coalescing to a
-- sentinel makes "global" a real, comparable value instead.
create unique index if not exists activity_questions_dedupe_idx
  on activity_questions (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), text);

-- ─────────────────────────────────────────────────────────────
-- activity_clauses — replaces activityClauses + baseClauses() text.
-- activity_id null  = base clause, applied to every waiver regardless
--                      of activity (assumption of risk, release,
--                      emergency, equipment, governing law).
-- question_id null  = unconditional — always inserted for that scope.
-- question_id set   = conditional — only inserted if the linked
--                      question was answered with trigger_value.
--
-- body_template supports {{name}}, {{activity}}, {{date}},
-- {{governing_law_state}}, {{governing_law_county}} placeholders,
-- substituted at generation time — this is what removes the hardcoded
-- "State of Arizona... Maricopa County" text from every waiver.
-- ─────────────────────────────────────────────────────────────

create table if not exists activity_clauses (
  id            uuid primary key default uuid_generate_v4(),
  operator_id   uuid not null references operators(id)          on delete cascade,
  activity_id   uuid references activities(id)                  on delete cascade, -- null = base clause
  question_id   uuid references activity_questions(id)          on delete cascade, -- null = unconditional
  key           text not null,
  title         text not null,
  body_template text not null,
  required      boolean not null default true,
  highlight     boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table activity_clauses enable row level security;
create policy "allow_all_activity_clauses" on activity_clauses
  for all using (true) with check (true);

create index if not exists activity_clauses_operator_idx
  on activity_clauses (operator_id, activity_id);

-- Same NULL-distinctness issue as activity_questions above — coalesce both
-- nullable FKs to sentinels so base clauses (activity_id null) and
-- unconditional clauses (question_id null) are still real, dedupable rows.
create unique index if not exists activity_clauses_dedupe_idx
  on activity_clauses (
    operator_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(question_id, '00000000-0000-0000-0000-000000000000'),
    key
  );

-- Note: the minor/guardian clause is intentionally NOT modeled here.
-- It's driven by isMinor + guardianName from the identity step, before
-- any activity question is shown — forcing it into activity_questions
-- would mean faking a global "are you a minor?" question just to hang
-- a clause off it. Keeping it special-cased in application code.

-- ═════════════════════════════════════════════════════════════
-- Seed: Desert Ridge Adventures' current 4 hardcoded activities,
-- preserving existing behavior exactly on cutover.
-- ═════════════════════════════════════════════════════════════

insert into operators (slug, name, governing_law_state, governing_law_county)
values ('desert-ridge', 'Desert Ridge Adventures', 'Arizona', 'Maricopa County')
on conflict (slug) do nothing;

-- Base clauses (activity_id null) — same 5 clauses baseClauses() emits today.
-- Governing Law now templated instead of hardcoded.
insert into activity_clauses (operator_id, activity_id, question_id, key, title, body_template, required, highlight, sort_order)
select o.id, null, null, v.key, v.title, v.body_template, true, false, v.sort_order
from operators o,
  (values
    ('assumption',    'Assumption of Risk',
     'I, {{name}}, acknowledge that {{activity}} involves inherent risks and hazards. I voluntarily assume full responsibility for all risks of loss, property damage, or personal injury that may be sustained as a result of my participation.', 0),
    ('release',       'Release of Liability',
     'I hereby release, waive, and discharge the operator from any and all liability, claims, and actions arising out of or related to any loss, damage, or injury sustained while participating in {{activity}} on {{date}}.', 1),
    ('emergency',     'Emergency Medical Authorization',
     'In the event of an emergency, I authorize operator staff to secure emergency medical services on my behalf. I accept financial responsibility for any emergency medical treatment rendered.', 2),
    -- 3, 4 reserved for cardiac/injury conditional clauses below, matching
    -- generateClauses()'s splice(insertAt=2, ...) — inserted after Emergency,
    -- before Equipment, same as today's behavior.
    ('equipment',     'Equipment & Safety Briefing',
     'I confirm receipt of a full safety briefing and proper fitting of all required safety equipment prior to activity commencement.', 5),
    ('governing_law', 'Governing Law',
     'This agreement shall be governed by the laws of the State of {{governing_law_state}}. Any disputes shall be resolved in the courts of {{governing_law_county}}.', 6)
  ) as v(key, title, body_template, sort_order)
where o.slug = 'desert-ridge'
on conflict (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), coalesce(question_id, '00000000-0000-0000-0000-000000000000'), key) do nothing;

-- Activities — icon/color/base_risk_score carried over from
-- StepActivity.tsx, RosterTab.tsx, and RiskScore.tsx's activityRisk map.
insert into activities (operator_id, key, display_name, icon, accent_color, base_risk_score, sort_order)
select o.id, v.key, v.display_name, v.icon, v.accent_color, v.base_risk_score, v.sort_order
from operators o,
  (values
    ('kayak', 'Whitewater Kayaking', 'kayak', '#4B2ACF', 35, 0),
    ('hike',  'Canyon Hiking',       'hike',  '#15803D', 15, 1),
    ('atv',   'ATV Tour',            'atv',   '#EA580C', 25, 2),
    ('climb', 'Rock Climbing',       'climb', '#0891B2', 30, 3)
  ) as v(key, display_name, icon, accent_color, base_risk_score, sort_order)
where o.slug = 'desert-ridge'
on conflict (operator_id, key) do nothing;

-- Per-activity unconditional hazard clause — same text as activityClauses{} today.
insert into activity_clauses (operator_id, activity_id, question_id, key, title, body_template, required, highlight, sort_order)
select a.operator_id, a.id, null, v.key, v.title, v.body_template, true, true, 7
from activities a
join operators o on o.id = a.operator_id
join (values
    ('kayak', 'water',    'Water Hazards Acknowledgment',
     'I understand that whitewater kayaking involves exposure to fast-moving water, submerged obstacles, and potential for capsize. I confirm I am a capable swimmer and acknowledge that Class III–IV rapids present serious risk of injury or death.'),
    ('hike',  'terrain',  'Terrain & Environmental Hazards',
     'I understand that canyon hiking involves uneven terrain, extreme temperatures, flash flood risk, and limited emergency access. I confirm I am physically capable of completing the stated route.'),
    ('atv',   'vehicle',  'Motor Vehicle Operation',
     'I understand that ATV operation involves risk of rollover, collision, and ejection. I confirm I will comply with all speed limits and route restrictions and will not operate under the influence of any substance.'),
    ('climb', 'fall',     'Fall & Equipment Hazards',
     'I understand that rock climbing involves risk of falls and equipment failure. I confirm I have received and understood the safety briefing for all anchor systems, belay devices, and harness equipment.')
  ) as v(activity_key, key, title, body_template) on v.activity_key = a.key
where o.slug = 'desert-ridge'
on conflict (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), coalesce(question_id, '00000000-0000-0000-0000-000000000000'), key) do nothing;

-- Global health questions (activity_id null — apply across all activities,
-- matching the current engine's conditionClauses behavior) + their linked
-- conditional clauses. This is the one part of the seed that's genuinely
-- new structure, not a straight port — today these are checkbox-style
-- multi-select entries in HealthStatus, modeled here as two yes/no
-- questions so they fit the question -> triggers -> clause pattern.
with q_cardiac as (
  insert into activity_questions (operator_id, activity_id, text, type, sort_order, triggers_clause, trigger_value)
  select o.id, null, 'Do you have a cardiovascular or respiratory condition?', 'yes_no', 0, true, 'yes'
  from operators o where o.slug = 'desert-ridge'
  on conflict (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), text) do nothing
  returning id, operator_id
),
q_injury as (
  insert into activity_questions (operator_id, activity_id, text, type, sort_order, triggers_clause, trigger_value)
  select o.id, null, 'Have you had a recent injury or surgery?', 'yes_no', 1, true, 'yes'
  from operators o where o.slug = 'desert-ridge'
  on conflict (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), text) do nothing
  returning id, operator_id
)
insert into activity_clauses (operator_id, activity_id, question_id, key, title, body_template, required, highlight, sort_order)
select operator_id, null::uuid, id, 'cardiac', 'Physician Clearance — Cardiovascular Condition',
  '{{name}} has disclosed a cardiovascular or respiratory condition. Participant confirms written physician clearance within 30 days. Participation without valid clearance voids this waiver.', true, true, 3
from q_cardiac
union all
select operator_id, null::uuid, id, 'injury', 'Recent Injury Disclosure',
  '{{name}} has disclosed a recent injury or surgery. Participant confirms physician clearance for physical activity of this intensity.', true, true, 4
from q_injury
on conflict (operator_id, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'), coalesce(question_id, '00000000-0000-0000-0000-000000000000'), key) do nothing;

-- ═════════════════════════════════════════════════════════════
-- operator_id: widen now, narrow later (two-step, non-destructive)
-- ═════════════════════════════════════════════════════════════
-- sessions.operator_id and notifications.operator_id are both
-- `text default 'desert-ridge'` today — a free-floating slug, not a
-- real foreign key, per the M4 exit criterion. Dropping/renaming the
-- text column now would break every read/write path still coded
-- against it (RosterTab, NotificationTab, analytics.ts, etc.) before
-- they're updated to use the new column. So:
--
-- STEP A (this migration) — add the real FK alongside the old column,
-- backfilled by matching the existing slug text against operators.slug.

alter table sessions
  add column if not exists operator_uuid uuid references operators(id);

update sessions s
set operator_uuid = o.id
from operators o
where s.operator_id = o.slug and s.operator_uuid is null;

alter table notifications
  add column if not exists operator_uuid uuid references operators(id);

update notifications n
set operator_uuid = o.id
from operators o
where n.operator_id = o.slug and n.operator_uuid is null;

-- STEP B (DO NOT RUN YET — separate follow-up migration, after
-- application code is switched to read/write operator_uuid):
--
--   alter table sessions      drop column operator_id;
--   alter table sessions      rename column operator_uuid to operator_id;
--   alter table sessions      alter column operator_id set not null;
--   alter table notifications drop column operator_id;
--   alter table notifications rename column operator_uuid to operator_id;
--   alter table notifications alter column operator_id set not null;
