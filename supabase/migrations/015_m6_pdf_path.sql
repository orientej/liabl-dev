-- Milestone 6 security review — replace long-lived signed URLs with
-- on-demand short-lived generation
-- =================================================================
-- Ships together with lib/seal.ts (stops generating a 10-year signed URL
-- at upload time), app/api/waivers/[id]/pdf-url/route.ts (generates a
-- short-lived one on demand, scoped by the requester's own RLS-checked
-- operator access), and WaiverDetail.tsx (calls that route instead of
-- opening a stored URL directly).
--
-- Why this matters: legal_hold waivers are specifically EXEMPT from the
-- 90-day retention purge — meaning the most sensitive documents (the
-- ones actually tied to an incident) kept the longest-lived, most
-- exposure-prone access path, indefinitely, with no way to revoke a
-- leaked URL short of deleting the very evidence the hold exists to
-- preserve.
--
-- pdf_path is deterministic (waivers/{yyyy}/{mm}/{waiverId}.pdf, derived
-- from signed_at + id — see lib/seal.ts's uploadPdf and this same logic
-- already used in the retention purge route) so it can be backfilled for
-- every existing sealed waiver without touching Storage at all.
--
-- pdf_url is nulled out for all rows once backfilled — going forward
-- nothing writes to it. This removes OUR OWN stored copy of the
-- long-lived URLs; it does not (and cannot) revoke a URL that was
-- already extracted and used elsewhere before this migration runs, since
-- Supabase Storage signed URLs have no early-revocation mechanism short
-- of deleting or moving the underlying object. That residual exposure
-- for any ALREADY-LEAKED historical URL is a known, accepted limitation
-- of this fix — closing it fully would mean rotating every existing
-- sealed PDF to a new storage path, a separate, larger, riskier bulk
-- operation not undertaken here.

alter table waivers
  add column if not exists pdf_path text;

update waivers
set pdf_path = 'waivers/' || extract(year from signed_at) || '/' || lpad(extract(month from signed_at)::text, 2, '0') || '/' || id || '.pdf'
where pdf_url is not null
  and pdf_path is null
  and signed_at is not null;

update waivers
set pdf_url = null
where pdf_url is not null;
