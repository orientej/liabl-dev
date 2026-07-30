-- Public API v1 — Phase A foundation: API keys + request log
-- =================================================================
-- Per-operator API keys authenticate machine clients (booking engines,
-- third-party developers) to the /api/v1 surface. A key is scoped to ONE
-- operator; the API auth layer derives the operator from the key and
-- enforces it on every query — a client can never reference another
-- operator's data.
--
-- SECURITY:
--   * The full key is shown once at creation, then only its SHA-256 HASH
--     is stored (key_hash) — the plaintext is never persisted or
--     retrievable. key_prefix + last4 identify a key in the UI/logs
--     without revealing it.
--   * Scopes gate what each key can do (least privilege).
--   * These tables have operator-scoped RLS for CONSOLE management only.
--     The /api/v1 auth path itself reads api_keys by hash via the
--     service-role client (the caller is unauthenticated — an API client,
--     not a logged-in user), which bypasses RLS by design; it then scopes
--     every downstream query to the key's operator_id in application code.
--
-- Additive only.

create table if not exists api_keys (
  id           uuid primary key default uuid_generate_v4(),
  operator_id  uuid not null references operators(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,            -- e.g. 'liabl_live_ab12' (safe to show)
  last4        text not null,
  key_hash     text not null,            -- sha-256 hex of the full key; the only stored form
  scopes       text[] not null default '{}',
  mode         text not null default 'live' check (mode in ('live', 'test')),
  created_by   uuid references auth.users(id),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (key_hash)
);

create index if not exists api_keys_operator_idx on api_keys (operator_id);
create index if not exists api_keys_hash_idx     on api_keys (key_hash) where revoked_at is null;

-- Lightweight audit of API traffic. Also doubles as the rate-limit source
-- for v1 (count a key's rows in the trailing window) — no separate
-- counter table needed to start.
create table if not exists api_request_log (
  id           uuid primary key default uuid_generate_v4(),
  api_key_id   uuid references api_keys(id) on delete set null,
  operator_id  uuid,
  method       text,
  path         text,
  status_code  int,
  ip_address   text,
  created_at   timestamptz not null default now()
);

create index if not exists api_request_log_key_time_idx on api_request_log (api_key_id, created_at desc);
create index if not exists api_request_log_operator_idx on api_request_log (operator_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Operator staff manage their own keys and read their own request log in
-- the console. No public read. The API auth path and request-log writes go
-- through the service-role client (unauthenticated caller), which is not
-- subject to these policies.
alter table api_keys        enable row level security;
alter table api_request_log enable row level security;

-- Console: operator staff manage their own keys. NOTE: key_hash is never
-- SELECTed by application code (the console lists prefix/last4/scopes
-- only) — the column is readable under this policy but the app never
-- returns it, and the plaintext key it hashes is unrecoverable regardless.
create policy "api_keys_manage_own" on api_keys
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

create policy "api_request_log_select_own" on api_request_log
  for select using (operator_id = current_operator_id());
