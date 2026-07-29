-- Multi-Document Check-In — Phase 1, part 2: signed documents
-- =================================================================
-- One row per supplemental document a participant actually signs in a
-- check-in. Anchored to the existing waivers row (waiver_id), which
-- becomes the "check-in anchor": the liability waiver keeps ALL its
-- special behavior (risk scoring, health answers, incident links, legal
-- hold) untouched, and supplemental documents attach to it as simpler
-- body+signature records. This is the smaller-blast-radius choice over
-- rewriting waivers into a generic check-in table (a possible future
-- unification, deliberately not done now).
--
-- RLS mirrors waivers exactly (011_m5_rls_tighten.sql): operator staff
-- select their own; the anonymous participant flow INSERTs while signing
-- and UPDATEs only for the post-seal hash/pdf_path write-back; no public
-- select (the insert path generates its own UUID and never reads back);
-- no delete for anyone (signed legal documents aren't erasable via the
-- app layer). Sealed PDFs live in the SAME 'waivers' storage bucket under
-- a documents/ path prefix, so no new storage policy is needed — the
-- existing bucket_id = 'waivers' insert/select policies already cover it.
--
-- Additive only.

create table if not exists signed_documents (
  id                      uuid primary key default uuid_generate_v4(),
  -- The check-in anchor. Cascade: if a check-in's waiver is ever removed,
  -- its supplemental documents go with it (there's no delete path today,
  -- but the FK states the intended ownership).
  waiver_id               uuid not null references waivers(id) on delete cascade,
  -- Nullable: the template may be archived/deleted later, but the signed
  -- record must survive independently (its content is snapshotted below).
  document_template_id    uuid references document_templates(id),
  document_version_id     uuid references document_template_versions(id),
  operator_id             uuid not null references operators(id),
  participant_id          uuid not null references participants(id),
  -- Denormalized, snapshot-at-signing content — self-contained and immune
  -- to later template edits, the same guarantee waivers.clauses gives.
  title_snapshot          text not null,
  body_snapshot           text not null,
  signature_data          text not null,   -- data-URL, same format as waivers.signature_data
  is_minor                boolean not null default false,
  guardian_name           text,
  guardian_signature_data text,            -- guardian's drawn signature (minors); see minor_guardian_signature_mode
  signed_at               timestamptz not null,
  ip_address              text,
  -- Sealing, mirroring waivers' pdf_path/document_hash/seal_error.
  document_hash           text,
  pdf_path                text,            -- documents/{yyyy}/{mm}/{waiverId}-{docKey}.pdf, in the 'waivers' bucket
  seal_error              text,
  created_at              timestamptz not null default now()
);

create index if not exists signed_documents_waiver_idx
  on signed_documents (waiver_id);
create index if not exists signed_documents_operator_idx
  on signed_documents (operator_id);
create index if not exists signed_documents_version_idx
  on signed_documents (document_version_id);

alter table signed_documents enable row level security;

create policy "signed_documents_select_own_operator" on signed_documents
  for select using (operator_id = current_operator_id());

-- Participant signing insert. Same posture as waivers_public_insert:
-- with check (true), because there is no participant-side identity to
-- scope against, and the row is written with a client-generated UUID and
-- never read back. (Same documented limitation as waivers.)
create policy "signed_documents_public_insert" on signed_documents
  for insert with check (true);

-- Two separate UPDATE policies for the same reason waivers has them:
-- permissive policies are OR'd, so the anon seal-writeback path is scoped
-- to auth.role() = 'anon' to keep authenticated cross-operator staff out
-- of it, while operator staff update only their own rows.
create policy "signed_documents_update_own_operator" on signed_documents
  for update using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "signed_documents_anon_seal_writeback" on signed_documents
  for update using (auth.role() = 'anon') with check (auth.role() = 'anon');
