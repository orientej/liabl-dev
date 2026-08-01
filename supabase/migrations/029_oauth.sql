-- Public API — Phase D1: OAuth2 client-credentials
-- =================================================================
-- An alternative to static API keys: a partner registers an OAuth client
-- (client_id + client_secret), then exchanges those at POST /api/oauth/token
-- for a SHORT-LIVED bearer access token. Both api keys and these tokens are
-- accepted by the same /api/v1 auth path (dual-auth), so every existing
-- endpoint works with either.
--
-- SECURITY (same posture as api_keys):
--   * client_secret is shown ONCE at creation, then only its SHA-256 hash is
--     stored — never retrievable. client_id is a public identifier.
--   * access tokens are opaque random strings, stored only as a SHA-256 hash,
--     with a short expiry (1 hour). Never retrievable; issue a new one.
--   * the operator is derived from the client/token, never the request body.
--   * oauth_clients has operator-scoped RLS for console management; the token
--     endpoint and the /api/v1 auth path read via the service-role client.
--     oauth_access_tokens is service-role only (no public policy at all).
--
-- Additive only.

create table if not exists oauth_clients (
  id                 uuid primary key default uuid_generate_v4(),
  operator_id        uuid not null references operators(id) on delete cascade,
  name               text not null,
  client_id          text not null,               -- public identifier: 'liabl_client_...'
  client_secret_hash text not null,               -- sha-256 hex of the secret; the only stored form
  scopes             text[] not null default '{}',
  mode               text not null default 'live' check (mode in ('live', 'test')),
  created_by         uuid references auth.users(id),
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  unique (client_id)
);

create index if not exists oauth_clients_operator_idx  on oauth_clients (operator_id);
create index if not exists oauth_clients_client_id_idx on oauth_clients (client_id) where revoked_at is null;

create table if not exists oauth_access_tokens (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references oauth_clients(id) on delete cascade,
  operator_id  uuid not null references operators(id) on delete cascade,
  token_hash   text not null,                      -- sha-256 hex of the opaque bearer token
  scopes       text[] not null default '{}',
  mode         text not null default 'live' check (mode in ('live', 'test')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  unique (token_hash)
);

-- The auth path's hot lookup: a live token by its hash.
create index if not exists oauth_access_tokens_hash_idx on oauth_access_tokens (token_hash);
create index if not exists oauth_access_tokens_expiry_idx on oauth_access_tokens (expires_at);

-- Audit + rate-limit log gains an OAuth principal column so OAuth traffic is
-- logged and rate-limited per client, exactly like api_key_id does for keys.
alter table api_request_log
  add column if not exists oauth_client_id uuid references oauth_clients(id) on delete set null;

create index if not exists api_request_log_oauth_time_idx on api_request_log (oauth_client_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table oauth_clients       enable row level security;
alter table oauth_access_tokens enable row level security;

-- Console: operator staff manage their own clients. client_secret_hash is
-- never SELECTed by application code (the console lists id/name/scopes only).
create policy "oauth_clients_manage_own" on oauth_clients
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

-- oauth_access_tokens: no policy on purpose. Only the service-role client
-- (token endpoint + auth path) touches it; RLS with no policy denies all
-- anon/authenticated access, which is exactly what we want for bearer tokens.
