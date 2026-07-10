-- Milestone 6+ — team invites
-- =================================================================
-- Lets an existing team member (owner OR staff — both can invite, per
-- explicit decision) bring a new person into their OWN operator, rather
-- than every new signup always creating a brand-new organization (the
-- only path that existed before this).
--
-- Two design choices worth stating plainly:
--
-- 1. operator_members gets a denormalized `email` column. Client-side
--    Supabase queries can't join auth.users directly (it isn't exposed
--    via the standard REST API), and building a security-definer
--    function just to list teammates' emails is more machinery than a
--    simple denormalized copy, captured once at the moment someone joins
--    (owner via completeOperatorSetup, staff via invite acceptance) and
--    never needing to change afterward for this feature's purposes.
--
-- 2. operator_invites has NO public/anon RLS policy at all, unlike
--    activities/sessions/etc. Someone accepting an invite doesn't belong
--    to the target operator yet, so normal RLS (scoped to
--    current_operator_id()) can't authorize them — but that's fine,
--    because acceptance never goes through a direct client-side RLS-
--    scoped query in the first place. It goes through
--    app/api/invites/accept/route.ts, which uses the service-role admin
--    client and treats possession of the token itself as the
--    authorization (same pattern as a password-reset link) — not
--    row-level security. Leaving this table RLS-locked to existing
--    members only (for management: create/list/revoke) means a random
--    unauthenticated request can't enumerate pending invites — which a
--    permissive `using (true)` SELECT policy would allow, leaking who's
--    being invited where.

alter table operator_members
  add column if not exists email text;

-- One-time backfill for the operator(s) already created before this
-- migration (currently just Desert Ridge Adventures' owner). Only this
-- migration file runs with the elevated privileges needed to join
-- auth.users directly — nothing in the app ever does this itself.
update operator_members m
set email = u.email
from auth.users u
where m.user_id = u.id
  and m.email is null;

create table if not exists operator_invites (
  id          uuid primary key default uuid_generate_v4(),
  operator_id uuid not null references operators(id) on delete cascade,
  email       text not null,
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  token       uuid not null default uuid_generate_v4(),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by  uuid references auth.users(id),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now(),
  unique (token)
);

alter table operator_invites enable row level security;

-- Management (create/list/revoke): any current member of the operator,
-- any role — matching the "owner and staff both can invite" decision.
-- No update-to-accept path here at all; acceptance is handled entirely
-- by the admin-client route, not by a client-side RLS-authorized update.
create policy "operator_invites_manage_own" on operator_invites
  for all using (operator_id = current_operator_id()) with check (operator_id = current_operator_id());

create index if not exists operator_invites_operator_idx on operator_invites (operator_id);
create index if not exists operator_invites_token_idx on operator_invites (token) where status = 'pending';
