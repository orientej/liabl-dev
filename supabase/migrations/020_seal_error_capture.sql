-- Persistent sealing-error capture
-- =================================================================
-- Sealing failures (PDF generation or Storage upload) have only ever
-- been visible via console.error in the PARTICIPANT's own browser at
-- the exact moment of failure — meaning diagnosing a real failure
-- required either the participant or someone testing the flow to have
-- dev tools open at exactly the right time. That's not durable enough
-- given how many rounds of "still not working" this has already taken
-- to even get consistent detail out of.
--
-- seal_error stores the actual thrown error message (or hash-write-back
-- error) the moment it happens, so it's queryable and displayable from
-- the operator dashboard afterward — no need to catch it live.

alter table waivers
  add column if not exists seal_error text;
