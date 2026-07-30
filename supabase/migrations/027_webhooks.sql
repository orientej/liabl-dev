-- Public API v1 — Phase B: outbound webhooks
-- =================================================================
-- Lets an operator register HTTPS endpoints that Liabl POSTs to the
-- moment something happens (a waiver is signed, a reservation completes,
-- etc.). This is the push counterpart to the Phase A polling endpoints —
-- the signal a booking engine actually wants.
--
-- Two tables:
--   webhook_endpoints   — an operator's registered destinations + the
--                         HMAC secret used to sign deliveries to them.
--   webhook_deliveries  — one row per (event x subscribed endpoint), the
--                         durable outbox the cron dispatcher drains. A row
--                         is inserted server-side where the event happens
--                         (seal write-back / member-complete), then the
--                         dispatcher POSTs it with retries.
--
-- SECURITY:
--   * secret is shown ONCE at creation (like an API key) and used to sign
--     every delivery (X-Liabl-Signature) so the receiver can verify
--     authenticity. The console never re-displays it.
--   * Both tables are operator-scoped by RLS for CONSOLE use only. Event
--     emission and the dispatcher run through the service-role client
--     (no logged-in user), which bypasses RLS by design and scopes every
--     query to the owning operator_id in application code.
--   * No public read.
--
-- Additive only.

create table if not exists webhook_endpoints (
  id            uuid primary key default uuid_generate_v4(),
  operator_id   uuid not null references operators(id) on delete cascade,
  url           text not null,
  secret        text not null,                 -- HMAC signing secret; shown once, never re-displayed
  event_types   text[] not null default '{}',  -- e.g. '{waiver.signed,reservation.completed}'
  active        boolean not null default true,
  description   text,
  created_by    uuid references auth.users(id),
  last_delivery_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists webhook_endpoints_operator_idx on webhook_endpoints (operator_id);

create table if not exists webhook_deliveries (
  id               uuid primary key default uuid_generate_v4(),
  endpoint_id      uuid not null references webhook_endpoints(id) on delete cascade,
  operator_id      uuid not null references operators(id) on delete cascade,
  event_type       text not null,
  event_id         uuid not null default uuid_generate_v4(),  -- stable id sent to the consumer (idempotency key)
  payload          jsonb not null,
  status           text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  attempts         int  not null default 0,
  max_attempts     int  not null default 6,
  last_status_code int,
  last_error       text,
  next_attempt_at  timestamptz not null default now(),
  delivered_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- The dispatcher's hot path: "give me pending deliveries that are due."
create index if not exists webhook_deliveries_due_idx
  on webhook_deliveries (next_attempt_at) where status = 'pending';
-- Console: an endpoint's / operator's recent deliveries, newest first.
create index if not exists webhook_deliveries_endpoint_idx on webhook_deliveries (endpoint_id, created_at desc);
create index if not exists webhook_deliveries_operator_idx on webhook_deliveries (operator_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Operator staff manage their own endpoints and read/redeliver their own
-- deliveries in the console. No public read. Emission + the dispatcher use
-- the service-role client (unauthenticated system caller), not subject to
-- these policies.
alter table webhook_endpoints  enable row level security;
alter table webhook_deliveries enable row level security;

-- Endpoints: operator staff fully manage their own. NOTE: `secret` is never
-- SELECTed by application code (the console lists url/events/active only) —
-- readable under this policy but the app never returns it, mirroring how
-- api_keys.key_hash is handled.
create policy "webhook_endpoints_manage_own" on webhook_endpoints
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

-- Deliveries: operator staff read their own...
create policy "webhook_deliveries_select_own" on webhook_deliveries
  for select using (operator_id = current_operator_id());
-- ...and may reset one to retry (redeliver from the console). Restricted to
-- their own operator on both sides; the dispatcher (service-role) is what
-- actually re-sends it.
create policy "webhook_deliveries_update_own" on webhook_deliveries
  for update using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
