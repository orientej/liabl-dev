-- Private Labeling (in-app branding) — Phase 1
-- =================================================================
-- Per-operator brand: logo + primary/accent colors + an option to hide
-- the "Powered by Liabl" attribution. Applied at runtime to the
-- participant-facing surfaces (check-in, organizer/reservation pages,
-- confirmation email, sealed PDF) on the shared re.liabl.ai host. Custom
-- domains are a later phase.
--
-- One row per operator (1:1). Absent row = Liabl defaults everywhere.
--
-- RLS NOTE — deliberately different from the PII tables:
--   Branding (a logo URL + two colors + a boolean) is NOT sensitive; it is
--   shown to every unauthenticated participant by definition. So this table
--   has a PUBLIC SELECT policy — the anonymous participant flow reads the
--   operator's branding to theme itself. WRITES are operator-scoped (a
--   logged-in operator manages only its own row), enforced here and done
--   through an authenticated console route.
--
-- Additive only.

create table if not exists operator_branding (
  operator_id      uuid primary key references operators(id) on delete cascade,
  logo_url         text,                                   -- public URL: uploaded to the 'branding' bucket, or external
  primary_color    text,                                   -- '#RRGGBB'; null = Liabl default
  accent_color     text,                                   -- '#RRGGBB'; null = Liabl default
  hide_powered_by  boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table operator_branding enable row level security;

-- Public read: the participant surfaces (anon) must resolve branding to
-- render it. Non-sensitive by design.
create policy "operator_branding_public_read" on operator_branding
  for select using (true);

-- Operator staff manage only their own branding row.
create policy "operator_branding_manage_own" on operator_branding
  for all
  using (operator_id = current_operator_id())
  with check (operator_id = current_operator_id());

-- ── Storage (manual, needs Joe) ──────────────────────────────────────────
-- Logo UPLOADS require a PUBLIC storage bucket named 'branding' (Supabase
-- buckets cannot be created via SQL; create it in Storage → New bucket,
-- mark it Public). Recommended policies for that bucket:
--   * public SELECT (bucket_id = 'branding')  -- so participant browsers load logos
--   * authenticated INSERT/UPDATE (bucket_id = 'branding')  -- operators upload
-- The "paste a hosted URL" option works without this bucket.
