-- Multi-Document Check-In — Phase 1, part 1: document templates
-- =================================================================
-- Until now an operator's only signable content has been the adaptive
-- liability waiver assembled from an activity's activity_clauses. This
-- migration adds SUPPLEMENTAL documents — a photo/media release, a code
-- of conduct, a rental agreement, etc. — that a participant signs in the
-- same check-in, each as its own document with its own signature and its
-- own sealed PDF.
--
-- Modeled deliberately on the activities + template_versions pattern
-- (007_m4_activities.sql, 021_template_versioning.sql):
--   * document_templates is the mutable "draft" an operator authors.
--   * Publishing snapshots the whole document into
--     document_template_versions as immutable JSONB, exactly like
--     activities publish into template_versions.
--   * A participant renders and signs the PUBLISHED snapshot; the signed
--     record (signed_documents, migration 024) stores its own rendered
--     body snapshot, so it is self-contained and immune to later edits —
--     the same "snapshot-at-signing" guarantee waivers.clauses provides.
--
-- Additive only: no existing column is dropped or renamed.

-- ─────────────────────────────────────────────────────────────
-- operators — per-operator minor-guardian signature policy
-- ─────────────────────────────────────────────────────────────
-- Decision (Joe, 7/29): operators choose whether a minor's guardian
-- signs EACH required document separately, or signs ONCE for the whole
-- check-in (that single signature is then applied to every document's
-- sealed PDF). Default 'per_document' — the more defensible posture.
alter table operators
  add column if not exists minor_guardian_signature_mode text not null default 'per_document'
    check (minor_guardian_signature_mode in ('per_document', 'single'));

-- ─────────────────────────────────────────────────────────────
-- document_templates — the mutable draft an operator authors
-- ─────────────────────────────────────────────────────────────
create table if not exists document_templates (
  id                     uuid primary key default uuid_generate_v4(),
  operator_id            uuid not null references operators(id) on delete cascade,
  key                    text not null,               -- stable slug, unique per operator (e.g. 'photo-release')
  title                  text not null,               -- 'Photo & Media Release'
  body                   text not null default '',    -- document text; supports {{name}}/{{activity}}/{{date}} vars, same as clauses
  required               boolean not null default true,
  -- 'all'        -> applies to every activity of this operator
  -- 'activities' -> applies only to activities listed in document_template_activities
  applies_to             text not null default 'all'
                           check (applies_to in ('all', 'activities')),
  sort_order             int  not null default 0,
  -- Publish/version tracking, mirroring activities' columns exactly.
  -- current_version_id's FK to document_template_versions is added by
  -- ALTER at the bottom of this migration — the two tables reference each
  -- other, so the constraint can't be declared inline (same reason
  -- 021_template_versioning added activities.current_version_id via ALTER
  -- after template_versions existed).
  current_version_id     uuid,
  current_version_number int,
  has_draft_changes      boolean not null default true,
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  unique (operator_id, key)
);

create index if not exists document_templates_operator_idx
  on document_templates (operator_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- document_template_activities — per-activity applicability
-- ─────────────────────────────────────────────────────────────
-- Only consulted when a document_templates.applies_to = 'activities'.
-- A join table (not an array column) so it FK-cascades cleanly when an
-- activity is deleted, matching how the rest of the schema models
-- activity relationships.
create table if not exists document_template_activities (
  document_template_id uuid not null references document_templates(id) on delete cascade,
  activity_id          uuid not null references activities(id) on delete cascade,
  operator_id          uuid not null references operators(id) on delete cascade,
  primary key (document_template_id, activity_id)
);

create index if not exists document_template_activities_activity_idx
  on document_template_activities (activity_id);

-- ─────────────────────────────────────────────────────────────
-- document_template_versions — immutable published snapshots
-- ─────────────────────────────────────────────────────────────
-- One row per published version. snapshot holds the complete document as
-- it existed at publish time:
--   { "title": text, "body": text, "required": bool, "applies_to": text,
--     "activity_keys": [text]  -- resolved activity keys, for a fully
--                                 self-contained snapshot independent of
--                                 mutable document_template_activities }
create table if not exists document_template_versions (
  id                   uuid primary key default uuid_generate_v4(),
  operator_id          uuid not null references operators(id) on delete cascade,
  document_template_id uuid not null references document_templates(id) on delete cascade,
  version_number       int  not null,
  snapshot             jsonb not null,
  change_note          text,
  published_by         uuid references auth.users(id),
  published_by_email   text,
  published_at         timestamptz not null default now(),
  unique (document_template_id, version_number)
);

create index if not exists document_template_versions_template_idx
  on document_template_versions (document_template_id, version_number desc);

-- Now that document_template_versions exists, wire up the back-reference
-- from document_templates.current_version_id. Guarded so re-running the
-- migration doesn't error on a duplicate constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'document_templates_current_version_fk'
  ) then
    alter table document_templates
      add constraint document_templates_current_version_fk
      foreign key (current_version_id) references document_template_versions(id);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- Same two-audience posture as activities/template_versions:
--   (a) operator staff manage their own rows (current_operator_id())
--   (b) the anonymous participant flow reads PUBLISHED content only,
--       resolved by session/QR — never by auth.uid()
-- ─────────────────────────────────────────────────────────────
alter table document_templates          enable row level security;
alter table document_template_activities enable row level security;
alter table document_template_versions   enable row level security;

-- document_templates: staff manage own; public reads only live published,
-- non-archived documents (the participant needs to know which documents
-- apply). The mutable draft body is not sensitive, but gating public read
-- on current_version_id keeps unpublished drafts out of the participant
-- flow — the analogue of activities_public_read_published's published=true.
create policy "document_templates_manage_own" on document_templates
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "document_templates_public_read_published" on document_templates
  for select using (current_version_id is not null and archived_at is null);

-- document_template_activities: staff manage own; public read (true), same
-- as activity_questions/activity_clauses — the participant flow needs to
-- resolve applicability and none of it is sensitive.
create policy "document_template_activities_manage_own" on document_template_activities
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "document_template_activities_public_read" on document_template_activities
  for select using (true);

-- document_template_versions: staff manage own; public read (true) so the
-- participant flow can read the published snapshot body it will render and
-- sign. Snapshots are blank template text (no participant/health data),
-- same sensitivity class as activity_clauses. No update/delete: versions
-- are immutable once published, exactly like template_versions.
create policy "document_template_versions_manage_own" on document_template_versions
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "document_template_versions_public_read" on document_template_versions
  for select using (true);
