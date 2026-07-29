-- Group Reservations — Phase 1 foundation
-- =================================================================
-- A reservation groups a party under one booking so their waivers (and
-- any applicable supplemental documents) can be collected together —
-- primarily AHEAD of the event, by the organizer inviting each attendee a
-- personal check-in link. Phase 1 binds a reservation to a session, so the
-- entire existing check-in machinery (operator resolution, version
-- pinning, QR, archived-guard) is reused unchanged.
--
-- SECURITY NOTE — this schema holds PII (organizer + member email) that
-- sessions/activities do NOT. So, unlike sessions (which has a broad
-- public-read policy for the anonymous participant flow), these tables get
-- operator-scoped RLS ONLY, with NO public-read. Every unauthenticated
-- touch — a member opening their link, the organizer managing their party,
-- the participant flow resolving a reservation — goes through a tokenised
-- admin-client route (the operator_invites / /api/invites/accept pattern),
-- which returns only what that token entitles. Nothing here is readable by
-- an anonymous Supabase query.
--
-- Additive only.

-- ─────────────────────────────────────────────────────────────
-- reservations
-- ─────────────────────────────────────────────────────────────
create table if not exists reservations (
  id                 uuid primary key default uuid_generate_v4(),
  operator_id        uuid not null references operators(id) on delete cascade,
  activity_key       text not null,
  -- Phase 1: the bound session the check-in runs against. Nullable so a
  -- future session-less reservation model doesn't require a migration.
  session_id         uuid references sessions(id),
  reservation_date   date,
  party_size         int,
  organizer_name     text,
  organizer_email    text,
  status             text not null default 'open'
                       check (status in ('open', 'complete', 'cancelled')),
  -- The organizer's manage link (possession = capability), same trust
  -- model as operator_invites.token.
  self_service_token uuid not null default uuid_generate_v4(),
  notes              text,
  created_by         uuid references auth.users(id),   -- null when created via self-service
  created_at         timestamptz not null default now(),
  unique (self_service_token)
);

create index if not exists reservations_operator_idx on reservations (operator_id, reservation_date desc);
create index if not exists reservations_session_idx  on reservations (session_id);

-- ─────────────────────────────────────────────────────────────
-- reservation_members — invited attendees
-- ─────────────────────────────────────────────────────────────
create table if not exists reservation_members (
  id             uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  operator_id    uuid not null references operators(id) on delete cascade,
  full_name      text,
  email          text,
  -- Personal check-in link (possession = capability).
  member_token   uuid not null default uuid_generate_v4(),
  -- Set when this member completes a check-in (service-role write from the
  -- member-complete route — see app code).
  waiver_id      uuid references waivers(id),
  status         text not null default 'invited'
                   check (status in ('invited', 'signed')),
  invited_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (member_token)
);

create index if not exists reservation_members_reservation_idx on reservation_members (reservation_id);
create index if not exists reservation_members_operator_idx    on reservation_members (operator_id);

-- ─────────────────────────────────────────────────────────────
-- waivers — back-links to the reservation/member a check-in belongs to
-- ─────────────────────────────────────────────────────────────
-- Nullable: the overwhelming majority of waivers are not part of a
-- reservation, and legacy waivers predate this entirely. Written at
-- signing (reservation_id by the participant insert; reservation_member_id
-- by the member-complete route, which also flips the member to 'signed').
alter table waivers
  add column if not exists reservation_id        uuid references reservations(id),
  add column if not exists reservation_member_id uuid references reservation_members(id);

create index if not exists waivers_reservation_idx on waivers (reservation_id) where reservation_id is not null;

-- ─────────────────────────────────────────────────────────────
-- RLS — operator-scoped only, NO public read (PII). See top comment.
-- ─────────────────────────────────────────────────────────────
alter table reservations        enable row level security;
alter table reservation_members enable row level security;

create policy "reservations_manage_own" on reservations
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

create policy "reservation_members_manage_own" on reservation_members
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

-- No participant/anon policies by design: the anonymous participant flow
-- and the organizer self-service page reach this data ONLY through
-- tokenised admin-client (service-role) routes, never a direct client
-- query. The waivers back-link columns are covered by waivers' existing
-- policies (011_m5_rls_tighten.sql) — the participant insert already runs
-- with check (true), so it may set reservation_id; reservation_member_id
-- is written by the service-role member-complete route.
