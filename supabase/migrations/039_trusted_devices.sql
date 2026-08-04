-- Trusted devices — "remember this device" for MFA
-- =================================================================
-- MFA is required for every operator user. "Remember this device" lets a
-- user skip the second-factor challenge on a browser they've explicitly
-- marked as trusted, for a bounded window (30 days) — the standard
-- convenience-vs-security trade every major provider offers.
--
-- SECURITY:
--   * A random per-device secret is generated server-side and stored ONLY
--     as its SHA-256 hash (token_hash) — the same one-way pattern as
--     api_keys. The plaintext secret lives only in an HttpOnly, Secure
--     cookie on the user's browser; the server can verify it (hash +
--     compare) but never recover it.
--   * Each row is bound to ONE auth user. The middleware aal2 gate accepts
--     an aal1 session ONLY when a non-expired trusted_devices row matches
--     the cookie for THAT user — so the bypass is revocable (delete the
--     row) and per-user, never a blanket weakening of MFA.
--   * RLS restricts every user to their own rows (auth.uid()). The
--     verify/insert path in the route handler uses the service-role client
--     with user_id taken from the authenticated session, never from input.
--
-- Additive only.

create table if not exists trusted_devices (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token_hash   text not null,          -- sha-256 hex of the device secret; the only stored form
  user_agent   text,                   -- so the user can recognise the device in settings
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  unique (token_hash)                    -- also provides the lookup index for hash verification
);

create index if not exists trusted_devices_user_idx on trusted_devices (user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Every user sees and revokes only their own trusted devices. Inserts and
-- the middleware hash-verification lookup are performed by the route
-- handler / user-scoped session; there is deliberately no INSERT policy —
-- new trust records are created only via the service-role route, which
-- derives user_id from the authenticated session.
alter table trusted_devices enable row level security;

create policy "trusted_devices_select_own" on trusted_devices
  for select using (user_id = auth.uid());

create policy "trusted_devices_delete_own" on trusted_devices
  for delete using (user_id = auth.uid());
