-- Stripe payments — S1: operator subscriptions
-- =================================================================
-- Wires Stripe subscription billing to the existing per-operator plan limit.
-- Until now operators.plan_signature_limit was set by hand (013_m5_billing);
-- now a verified Stripe webhook sets both the plan_key and the limit from the
-- plan catalog (lib/stripe.ts) whenever a subscription is created/updated/
-- cancelled. Nothing here charges anyone — Stripe does; this just records the
-- identifiers and the resulting plan.
--
-- SECURITY: only Stripe identifiers are stored — never card data. The webhook
-- runs on the service-role client (it has no operator session) and resolves
-- the operator by stripe_customer_id. stripe_events is an idempotency ledger:
-- Stripe delivers at-least-once, so each event.id is processed once.
-- Additive only.

alter table operators
  add column if not exists stripe_customer_id        text,
  add column if not exists stripe_subscription_id     text,
  add column if not exists stripe_subscription_status text,
  add column if not exists plan_key                    text not null default 'free';

-- Resolve an operator from a Stripe customer fast (webhook hot path).
create unique index if not exists operators_stripe_customer_idx
  on operators (stripe_customer_id) where stripe_customer_id is not null;

-- Idempotency ledger for inbound Stripe webhooks. A handler no-ops if the
-- event.id is already present.
create table if not exists stripe_events (
  event_id    text primary key,      -- Stripe event.id (e.g. evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);

-- Service-role only: enable RLS with no policy so no authenticated operator
-- can read the cross-operator event log; the webhook uses the service-role
-- client, which bypasses RLS.
alter table stripe_events enable row level security;
