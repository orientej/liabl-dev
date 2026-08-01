-- Minor-waiver hardening: configurable age of majority
-- =================================================================
-- The age at which a participant is legally an adult varies by jurisdiction
-- (18 in most US states, 19 in Alabama and Nebraska, 21 in Mississippi).
-- Previously the participant flow hardcoded 18. This makes it a per-operator
-- setting: a participant younger than the operator's age_of_majority is a
-- minor, so the guardian step + guardian signature are required.
--
-- Defaults to 18 (the prior behavior), so existing operators are unchanged.
-- Additive only.

alter table operators
  add column if not exists age_of_majority integer not null default 18
    check (age_of_majority between 16 and 25);
