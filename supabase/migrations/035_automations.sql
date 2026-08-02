-- Marketing automation — M3: automations
-- =================================================================
-- Two built-in lifecycle automations, one row per (operator, trigger):
--   * post_visit — a thank-you sent `delay_days` after a check-in.
--   * win_back   — a "we miss you" sent when a contact hasn't visited in
--                  `delay_days` (e.g. 90) days.
-- An operator configures each one (channel, subject/body, delay, on/off);
-- a cron evaluator finds due contacts and enqueues sends into an outbox that
-- the SAME dispatcher as M2 broadcasts drains via Resend / Twilio.
--
-- Idempotency is the whole game here: the evaluator runs every minute, so a
-- due contact must be enqueued EXACTLY once. `automation_sends.dedup_key`
-- carries a unique key that encodes the automation + the specific occasion
-- (a visit for post_visit; a lapse episode for win_back), and the evaluator
-- inserts with ON CONFLICT DO NOTHING — a duplicate is a no-op, not a resend.
--
-- SECURITY: operator-scoped RLS, no public read. Operators manage their own
-- config directly (RLS, like the marketing_enabled toggle); the evaluator +
-- dispatcher run on the service-role client (CRON_SECRET). Additive only.

create table if not exists automations (
  id          uuid primary key default uuid_generate_v4(),
  operator_id uuid not null references operators(id) on delete cascade,
  trigger     text not null check (trigger in ('post_visit', 'win_back')),
  channel     text not null default 'email' check (channel in ('email', 'sms')),
  subject     text,                          -- email only
  body        text not null default '',
  delay_days  int  not null default 1 check (delay_days between 0 and 3650),
  active      boolean not null default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One config per trigger per operator: an operator has (at most) one
  -- thank-you and one win-back. Upserts target this.
  unique (operator_id, trigger)
);

create index if not exists automations_active_idx on automations (operator_id) where active;

create table if not exists automation_sends (
  id                uuid primary key default uuid_generate_v4(),
  automation_id     uuid not null references automations(id) on delete cascade,
  operator_id       uuid not null references operators(id) on delete cascade,
  contact_id        uuid references marketing_contacts(id) on delete set null,
  participant_id    uuid references participants(id),
  trigger           text not null check (trigger in ('post_visit', 'win_back')),
  channel           text not null check (channel in ('email', 'sms')),
  to_address        text not null,             -- email address or E.164 phone (snapshot)
  to_name           text,                       -- recipient full name (snapshot) for {{first_name}}
  unsubscribe_token text not null,             -- snapshot, for the email footer link
  -- The idempotency key. Encodes automation + occasion, e.g.
  --   pv:{automationId}:{waiverId}                (once per visit)
  --   wb:{automationId}:{contactId}:{lastVisitYmd} (once per lapse episode)
  dedup_key         text not null unique,
  status            text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id       text,                       -- Resend / Twilio message id
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- The dispatcher's hot path: pending sends, oldest first.
create index if not exists automation_sends_pending_idx on automation_sends (created_at) where status = 'pending';
create index if not exists automation_sends_automation_idx on automation_sends (automation_id);

alter table automations      enable row level security;
alter table automation_sends enable row level security;

create policy "automations_manage_own" on automations
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "automation_sends_select_own" on automation_sends
  for select using (operator_id = current_operator_id());
