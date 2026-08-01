-- Public API — Phase D3: booking-engine connector framework
-- =================================================================
-- A generic inbound integration surface. A booking engine (or any middleware)
-- POSTs a booking to a per-connector URL; Liabl verifies it, maps the payload
-- to a reservation (creating the session + attendees + check-in links), and
-- records the result. One framework, per-type mappers (generic / fareharbor /
-- peek) — so new engines are a mapping, not new plumbing.
--
-- SECURITY:
--   * Each connector has a public `inbound_token` (the URL capability — the
--     endpoint is /api/connectors/{inbound_token}) and an optional
--     `signing_secret` used to HMAC-verify the incoming payload. Both are
--     shown once at creation; the secret is never re-displayed.
--   * The connector carries a `mode` — a 'test' connector produces sandbox
--     reservations (D2 isolation), so partners can integrate safely.
--   * connectors have operator-scoped RLS for console management;
--     connector_events are operator-readable. The inbound endpoint runs on the
--     service-role client (the caller is an external system, not a user) and
--     resolves the operator from the connector, never the request body.
--
-- Additive only.

create table if not exists connectors (
  id                   uuid primary key default uuid_generate_v4(),
  operator_id          uuid not null references operators(id) on delete cascade,
  type                 text not null default 'generic' check (type in ('generic', 'fareharbor', 'peek')),
  name                 text not null,
  inbound_token        text not null,               -- URL capability: /api/connectors/{inbound_token}
  signing_secret       text,                        -- optional HMAC secret to verify inbound payloads
  default_activity_key text,                         -- fallback Liabl activity when the payload maps none
  activity_map         jsonb not null default '{}', -- { "<engine product id>": "<liabl activity key>" }
  mode                 text not null default 'live' check (mode in ('live', 'test')),
  active               boolean not null default true,
  created_by           uuid references auth.users(id),
  last_event_at        timestamptz,
  created_at           timestamptz not null default now(),
  unique (inbound_token)
);

create index if not exists connectors_operator_idx on connectors (operator_id);
create index if not exists connectors_token_idx    on connectors (inbound_token) where active;

-- Inbound audit: one row per received booking, for debugging + a console log.
create table if not exists connector_events (
  id             uuid primary key default uuid_generate_v4(),
  connector_id   uuid not null references connectors(id) on delete cascade,
  operator_id    uuid not null references operators(id) on delete cascade,
  status         text not null,                     -- 'created' | 'ignored' | 'unauthorized' | 'error'
  external_ref   text,                              -- the booking id from the engine, when present
  reservation_id uuid,                              -- set when a reservation was created
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists connector_events_connector_idx on connector_events (connector_id, created_at desc);
create index if not exists connector_events_operator_idx  on connector_events (operator_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table connectors       enable row level security;
alter table connector_events enable row level security;

-- Console manages its own connectors. NOTE: signing_secret is never SELECTed
-- by application code (the console lists type/name/token/active only).
create policy "connectors_manage_own" on connectors
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

create policy "connector_events_select_own" on connector_events
  for select using (operator_id = current_operator_id());
