-- Milestone 5 — real operator authentication, part 1: operator_members
-- =================================================================
-- Links a Supabase Auth user (auth.users) to an operator (operators).
-- One user belongs to exactly one operator for V1 — simplest model that
-- matches the single-operator-per-login reality this app has had all
-- along; a person needing access to two operators is a real scenario but
-- not a V1 one.
--
-- RLS on this table is still allow_all, same status as every other table
-- in this schema — tightening RLS across the board (including this one)
-- is the deliberately separate next pass, now that auth.uid() actually
-- exists to key policies off of. Auth working correctly (login wall,
-- knowing who's who) does not yet mean the database enforces isolation
-- between operators — that's the explicit scope boundary of this
-- migration, not an oversight.

create table if not exists operator_members (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  operator_id uuid not null references operators(id)  on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  unique (user_id)
);

alter table operator_members enable row level security;
create policy "allow_all_operator_members" on operator_members
  for all using (true) with check (true);

create index if not exists operator_members_operator_idx
  on operator_members (operator_id);
