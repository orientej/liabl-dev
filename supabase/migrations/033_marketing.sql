-- Marketing automation — M1 foundation: consent capture + contacts
-- =================================================================
-- A per-operator marketing audience, captured at check-in with explicit,
-- per-channel consent that is SEPARATE from the transactional confirmation
-- email. This is the compliance foundation for broadcasts (M2) and
-- automations (M3), and the source for the contacts API / marketing.contact
-- webhook a 3rd-party platform syncs from.
--
-- One row per (operator, email). A participant can opt in to one operator's
-- marketing without affecting another's — consent is per operator, per
-- channel, with a timestamp. Unsubscribes are per channel and never deleted
-- (an audit trail + a suppression list).
--
-- SECURITY: this is PII (name / email / phone). Operator-scoped RLS, NO
-- public read. The opt-in write happens through a service-role route (the
-- anonymous participant can't write here), and the contacts API reads via the
-- key's operator only. Additive only.

create table if not exists marketing_contacts (
  id                     uuid primary key default uuid_generate_v4(),
  operator_id            uuid not null references operators(id) on delete cascade,
  participant_id         uuid references participants(id),
  email                  text not null,
  phone                  text,
  full_name              text,
  email_consent          boolean not null default false,
  sms_consent            boolean not null default false,
  email_consent_at       timestamptz,
  sms_consent_at         timestamptz,
  unsubscribed_email_at  timestamptz,
  unsubscribed_sms_at    timestamptz,
  unsubscribe_token      text not null,               -- capability for the public unsubscribe link (M2)
  source                 text not null default 'checkin',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (operator_id, email)
);

create index if not exists marketing_contacts_operator_idx on marketing_contacts (operator_id, created_at desc);
create index if not exists marketing_contacts_unsub_idx     on marketing_contacts (unsubscribe_token);
-- Fast "who can receive email / sms right now" lookups for M2/M3.
create index if not exists marketing_contacts_email_ok_idx on marketing_contacts (operator_id)
  where email_consent and unsubscribed_email_at is null;
create index if not exists marketing_contacts_sms_ok_idx on marketing_contacts (operator_id)
  where sms_consent and unsubscribed_sms_at is null;

-- Operators opt into marketing; until then the participant flow shows no
-- marketing capture and the console tab is a simple enable screen.
alter table operators
  add column if not exists marketing_enabled boolean not null default false;

alter table marketing_contacts enable row level security;

-- Operator staff manage their own contacts (console list/export). No public
-- read. The opt-in write + the contacts API use the service-role client.
create policy "marketing_contacts_manage_own" on marketing_contacts
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());
