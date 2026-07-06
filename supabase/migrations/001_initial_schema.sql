-- LIABL v12 initial schema
-- Run in Supabase SQL editor

create extension if not exists "uuid-ossp";

create table if not exists participants (
  id         uuid primary key default uuid_generate_v4(),
  email      text unique not null,
  full_name  text not null,
  dob        text,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id           uuid primary key default uuid_generate_v4(),
  operator_id  text default 'desert-ridge',
  activity_key text not null,
  session_time text,
  session_ref  text,
  created_at   timestamptz default now()
);

create table if not exists waivers (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid references sessions(id),
  participant_id uuid references participants(id),
  activity_key   text not null,
  answers        jsonb,
  clauses        jsonb,
  signed_at      timestamptz,
  signature_data text,
  is_minor       boolean default false,
  guardian_name  text,
  ip_address     text,
  risk_score     integer,
  risk_level     text,
  legal_hold     boolean default false,
  created_at     timestamptz default now()
);

create table if not exists incidents (
  id             uuid primary key default uuid_generate_v4(),
  ref            text unique not null,
  waiver_id      uuid references waivers(id),
  participant_name text,
  activity       text,
  severity       text check (severity in ('minor','moderate','serious')),
  description    text,
  status         text default 'open',
  carrier_notified_at timestamptz,
  created_at     timestamptz default now()
);

-- Row Level Security
alter table participants enable row level security;
alter table sessions    enable row level security;
alter table waivers     enable row level security;
alter table incidents   enable row level security;

-- Policies (allow all for demo — tighten for production)
create policy "allow_all_participants" on participants for all using (true) with check (true);
create policy "allow_all_sessions"     on sessions    for all using (true) with check (true);
create policy "allow_all_waivers"      on waivers     for all using (true) with check (true);
create policy "allow_all_incidents"    on incidents   for all using (true) with check (true);

-- Demo session
insert into sessions (activity_key, session_time, session_ref)
values ('kayak', '9:00 AM', 'AM-04')
on conflict do nothing;
