-- Global Admin Console — foundation
-- =================================================================
-- New privilege tier that sits ABOVE the per-operator tenant model this
-- whole schema has been built around so far. Deliberately NOT modeled
-- as another operator_members role — a LIABL support staff member isn't
-- an "operator" at all, and conflating the two would mean every
-- per-operator RLS policy needs an "or is_global_admin()" carve-out
-- bolted on, which is both more invasive and more error-prone than
-- keeping this cleanly separate.
--
-- Architectural decision worth stating plainly: the admin console does
-- NOT get its own web of per-table RLS bypass policies. Every admin
-- console read/write goes through a dedicated /api/admin/* route using
-- the existing service-role client (lib/supabase-admin.ts), which
-- double-checks liabl_admins membership server-side before doing
-- anything — the same pattern already established for
-- /api/invites/accept. The ONE exception is a narrow self-check policy
-- on liabl_admins itself (below), needed so the client can ask "am I an
-- admin" to route the UI correctly — that response is never trusted as
-- real authorization on its own; the API routes re-check independently.
--
-- liabl_admins has NO insert/update/delete policy at all — provisioning
-- a new admin is a direct-SQL operation only, not a self-serve flow.
-- This is intentional: closed by default, opened deliberately per
-- person, by whoever has direct database access.

create table if not exists liabl_admins (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table liabl_admins enable row level security;

create policy "liabl_admins_select_own" on liabl_admins
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- admin_audit_log — every privileged cross-tenant action, not just the
-- impersonation feature planned as a later follow-up. RLS enabled with
-- NO policies at all: this table is written and read exclusively
-- through service-role-backed API routes, never a direct client query,
-- even from an authenticated admin.
-- ─────────────────────────────────────────────────────────────

create table if not exists admin_audit_log (
  id                uuid primary key default uuid_generate_v4(),
  admin_user_id     uuid not null references auth.users(id),
  admin_email       text not null,
  action_type       text not null,
  target_operator_id uuid references operators(id),
  target_user_id    uuid,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);

alter table admin_audit_log enable row level security;

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_operator_idx on admin_audit_log (target_operator_id);

-- ─────────────────────────────────────────────────────────────
-- platform_settings — "platform-wide config/feature flags", per
-- explicit scoping. Generic key/value(jsonb) rather than a flags-only
-- boolean table: covers simple on/off flags (value: true/false) and
-- richer config (value: {...}) with the same shape, without needing a
-- second table later for anything that isn't strictly boolean. Same
-- RLS posture as admin_audit_log — service-role access only.
-- ─────────────────────────────────────────────────────────────

create table if not exists platform_settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       jsonb not null,
  description text,
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table platform_settings enable row level security;

-- Seed a couple of real starter flags rather than shipping an empty
-- table with no worked example of the intended shape.
insert into platform_settings (key, value, description) values
  ('new_operator_signups_enabled', 'true'::jsonb, 'Allow new operators to self-serve sign up and create an organization'),
  ('maintenance_mode', 'false'::jsonb, 'When true, show a maintenance banner across the operator dashboard (participant signing is never blocked by this)')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- operators.status — the missing piece for "customer account
-- management" to include suspend/reactivate. Deliberately no hard-
-- delete capability anywhere in this phase: suspension is reversible,
-- deleting an operator (and cascading through every waiver, incident,
-- and audit record tied to it) is not, and nothing in the actual ask
-- required an irreversible bulk-delete feature.
-- ─────────────────────────────────────────────────────────────

alter table operators
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));
