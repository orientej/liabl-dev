-- Marketing automation — M2: broadcast campaigns
-- =================================================================
-- A one-off email or SMS blast to the operator's opted-in audience. Sending
-- is decoupled from composing: creating a campaign snapshots the recipients
-- into campaign_sends (the outbox), and a cron dispatcher drains that outbox
-- via Resend (email) / Twilio (SMS). This keeps built-in marketing "basic" —
-- modest volume, best-effort delivery; large/complex sends go to a 3rd-party
-- platform via the contacts API.
--
-- Recipients are snapshotted at send time so later opt-outs/edits don't change
-- a campaign's history. Each send denormalizes the destination + the contact's
-- unsubscribe token, so the dispatcher needs no joins and the email footer's
-- unsubscribe link is always correct.
--
-- SECURITY: operator-scoped RLS, no public read. Creation is an authenticated
-- console route; the dispatcher runs on the service-role client (CRON_SECRET).
-- Additive only.

create table if not exists campaigns (
  id             uuid primary key default uuid_generate_v4(),
  operator_id    uuid not null references operators(id) on delete cascade,
  name           text not null,
  channel        text not null check (channel in ('email', 'sms')),
  subject        text,                         -- email only
  body           text not null,
  status         text not null default 'queued' check (status in ('draft', 'queued', 'sending', 'sent', 'failed')),
  audience_count int  not null default 0,
  sent_count     int  not null default 0,
  failed_count   int  not null default 0,
  created_by     uuid references auth.users(id),
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists campaigns_operator_idx on campaigns (operator_id, created_at desc);

create table if not exists campaign_sends (
  id                uuid primary key default uuid_generate_v4(),
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  operator_id       uuid not null references operators(id) on delete cascade,
  contact_id        uuid references marketing_contacts(id) on delete set null,
  channel           text not null check (channel in ('email', 'sms')),
  to_address        text not null,             -- email address or E.164 phone (snapshot)
  unsubscribe_token text not null,             -- snapshot, for the email footer link
  status            text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id       text,                       -- Resend / Twilio message id
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- The dispatcher's hot path: pending sends, oldest first.
create index if not exists campaign_sends_pending_idx on campaign_sends (created_at) where status = 'pending';
create index if not exists campaign_sends_campaign_idx on campaign_sends (campaign_id);

alter table campaigns      enable row level security;
alter table campaign_sends enable row level security;

create policy "campaigns_manage_own" on campaigns
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
create policy "campaign_sends_select_own" on campaign_sends
  for select using (operator_id = current_operator_id());
