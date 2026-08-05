-- Group reservations — check-in state
-- =================================================================
-- Until now a signed waiver was the only event a reservation tracked, so
-- an operator couldn't distinguish "signed their waiver (maybe days ago,
-- online)" from "physically showed up and was checked in." This adds that
-- second, distinct timestamp.
--
--   * checked_in_at is set when a party is checked in — either by the
--     operator's "Check in this group" action (a service-role update over
--     the reservation's signed waivers) or, later, by the kiosk/online
--     check-in flow marking an individual arrival. Both write the same
--     column, so the reservation card's "Checked in" count stays truthful
--     regardless of which path was used.
--   * Nullable and additive: every existing waiver is simply "not checked
--     in yet," which is correct.
--
-- Reads happen under waivers' existing operator-scoped RLS; the group
-- check-in write goes through the service-role route (app/api/reservations
-- /[id]/check-in), authorized by operator membership, never a client write.
--
-- Additive only.

alter table waivers
  add column if not exists checked_in_at timestamptz;

-- Supports the per-reservation checked-in count without scanning.
create index if not exists waivers_reservation_checkin_idx
  on waivers (reservation_id)
  where reservation_id is not null and checked_in_at is not null;
