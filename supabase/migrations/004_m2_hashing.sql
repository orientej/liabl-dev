-- v24 M2 item 3 — document hashing and PDF storage
-- =================================================
-- Additive migration — no destructive changes.
-- Safe to run against a database with existing waiver rows; new columns
-- will be NULL for waivers signed before this migration ran, which is
-- expected and handled in the WaiverDetail UI ("Pending — not yet hashed").
--
-- BEFORE RUNNING:
-- 1. Create the 'waivers' storage bucket in Supabase (see note below).
-- 2. Apply this migration.
-- 3. Deploy the updated ParticipantFlow.tsx (seal.ts call).
-- Order matters: the bucket must exist before the first signed waiver
-- tries to upload a PDF.

-- ─── Schema changes ──────────────────────────────────────────────────────────

alter table waivers
  add column if not exists document_hash text,
  add column if not exists pdf_url       text;

-- Index on document_hash for fast lookup/verification by hash alone
-- (e.g. an operator pasting a hash into a verification tool)
create index if not exists waivers_document_hash_idx on waivers (document_hash);

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- The 'waivers' bucket cannot be created via SQL; it must be created in the
-- Supabase dashboard or via the management API. Required settings:
--
--   Name:    waivers
--   Public:  NO (private — access via signed URLs only)
--
-- Recommended bucket policy (paste into Storage > Policies for 'waivers'):
-- Allow authenticated users to INSERT (upload) but not UPDATE or DELETE.
-- This enforces the immutability guarantee — once a PDF is sealed, no one
-- can overwrite or delete it through the API. The upsert:false flag in
-- seal.ts's uploadPdf() reinforces this at the application layer.
--
-- SQL equivalent (run in Supabase SQL editor after creating the bucket):
--
--   create policy "allow_upload_waivers" on storage.objects
--     for insert with check (bucket_id = 'waivers');
--
--   -- No update or delete policies — intentionally absent.
--
-- NOTE: While RLS is still allow_all for the waivers table (pending M5
-- auth/security pass), the Storage bucket policies above specifically
-- prevent overwrite/deletion of sealed PDFs even in the current demo
-- security model. This is the one storage policy worth setting now, before
-- M5, because it can't be easily undone after the fact.
