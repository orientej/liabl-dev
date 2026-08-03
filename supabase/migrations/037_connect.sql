-- Stripe payments — S2a: Connect (Express) onboarding
-- =================================================================
-- In-person participant payments flow to the OPERATOR, not to Liabl. Each
-- operator connects their own Stripe account (Express) and gets paid directly;
-- Liabl is the platform and may take an application fee (S2b). This migration
-- just records the connected-account id and its readiness flags — set by the
-- onboarding return + the account.updated webhook, never by hand.
--
-- SECURITY: only Stripe's account id + capability booleans are stored. Charges
-- are blocked until charges_enabled is true (Stripe gates this on the
-- operator finishing onboarding + verification). Additive only.

alter table operators
  add column if not exists stripe_connect_account_id text,
  add column if not exists connect_charges_enabled   boolean not null default false,
  add column if not exists connect_payouts_enabled   boolean not null default false;

-- Resolve an operator from a connected account fast (account.updated webhook).
create unique index if not exists operators_connect_account_idx
  on operators (stripe_connect_account_id) where stripe_connect_account_id is not null;
