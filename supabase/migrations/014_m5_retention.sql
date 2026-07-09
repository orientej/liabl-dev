-- Milestone 5 — 90-day document retention
-- =================================================================
-- Decision (confirmed explicitly, given this is irreversible): redact,
-- don't fully delete. A waiver's entire purpose is legal protection for
-- the operator — deleting all evidence it ever existed after 90 days
-- would undermine that if a claim surfaces later. So the purge job
-- (app/api/retention/purge/route.ts) nulls out the sensitive payload
-- (health answers, rendered clause text — which has the participant's
-- name baked into it, not just template text — signature image, the
-- sealed PDF itself both in Storage and its URL, and IP address) while
-- keeping a minimal stub: participant/session/activity linkage, signed
-- date, is_minor/guardian_name, and risk_score/risk_level (a computed
-- category, not the raw health answers that produced it). document_hash
-- is also kept — a fingerprint with real continuity value if a physical
-- or externally-held copy of the original document ever needs
-- verification, even after LIABL's own copy is gone.
--
-- redacted_at marks when this happened, both as an audit fact in its own
-- right and so the purge job's query is naturally idempotent (never
-- reprocesses an already-redacted row).

alter table waivers
  add column if not exists redacted_at timestamptz;

create index if not exists waivers_retention_idx
  on waivers (signed_at)
  where legal_hold = false and redacted_at is null;
