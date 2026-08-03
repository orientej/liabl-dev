-- Stripe payments — S2b: per-activity pricing + participant payments
-- =================================================================
-- Operators can put a price on an activity; a participant then pays it during
-- check-in, with the funds going to the operator's connected account (S2a).
-- The amount is ALWAYS derived server-side from the activity's price (the
-- check-in flow is anonymous — a browser-supplied amount can't be trusted), so
-- there is no per-check-in "type any amount" here; the operator sets the price
-- in the console.
--
-- SECURITY: payments is PII-adjacent (amounts + who paid). Operator-scoped RLS
-- SELECT, no public read. Rows are written only by the service-role payment
-- routes + the Stripe webhook (never by the anon participant client). Charges
-- are gated on the activity having a price AND the operator's Connect account
-- having charges enabled. Additive only.

-- null price = no charge for this activity (the default; nothing changes for
-- operators who don't use payments). Stored in cents.
alter table activities
  add column if not exists price_cents integer check (price_cents is null or price_cents >= 0);

create table if not exists payments (
  id                      uuid primary key default uuid_generate_v4(),
  operator_id             uuid not null references operators(id) on delete cascade,
  waiver_id               uuid references waivers(id) on delete set null,
  participant_id          uuid references participants(id) on delete set null,
  activity_key            text,
  stripe_payment_intent_id text not null unique,
  amount_cents            integer not null,
  currency                text not null default 'usd',
  application_fee_cents   integer not null default 0,
  connected_account_id    text,                       -- operator's Connect account at charge time (snapshot)
  status                  text not null default 'requires_payment'
                            check (status in ('requires_payment', 'succeeded', 'failed', 'canceled', 'refunded')),
  description             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists payments_operator_idx on payments (operator_id, created_at desc);
create index if not exists payments_waiver_idx    on payments (waiver_id);

alter table payments enable row level security;

-- Operator staff read their own payments (console list). Writes are service-
-- role only (the intent route + the webhook), so no insert/update policy.
create policy "payments_select_own" on payments
  for select using (operator_id = current_operator_id());
