// lib/connectors.ts
// Public API — Phase D3 booking-engine connector framework. SERVER-ONLY.
// Turns an inbound booking (from a booking engine or middleware) into a
// normalized shape, then a Liabl reservation. New engines are added as a
// mapper here — the plumbing (endpoint, auth, reservation creation, audit)
// stays the same.
//
// The generic mapper is the fully-specified contract any partner can POST to.
// The fareharbor/peek mappers are SCAFFOLDS: the field paths follow each
// engine's documented booking webhook, but must be validated against a real
// sandbox delivery before going live — marked inline where that matters.

import crypto from 'crypto'
import type { ConnectorType } from '@/lib/connectors-client'

// Re-export so server callers can import the type from here alongside the
// mappers; the value catalog (CONNECTOR_TYPES) lives in the client-safe module.
export type { ConnectorType }

export interface NormalizedBooking {
  externalRef: string | null          // the engine's booking id
  activityExternalId: string | null   // the engine's product/item id (mapped to a Liabl activity)
  activityKey: string | null          // an explicit Liabl activity key (generic payloads may send this)
  reservationDate: string | null      // YYYY-MM-DD
  partySize: number | null
  organizerName: string | null
  organizerEmail: string | null
  members: { full_name?: string; email?: string }[]
}

export function generateInboundToken(): string {
  return `cn_${crypto.randomBytes(18).toString('base64url')}`
}
export function generateSigningSecret(): string {
  return `cnsec_${crypto.randomBytes(24).toString('base64url')}`
}

/** Verify an inbound HMAC signature: hex(HMAC-SHA256(secret, rawBody)) sent in
 *  the `X-Liabl-Connector-Signature` header. Constant-time compare. When a
 *  connector has no signing_secret, verification is skipped (possession of the
 *  unguessable inbound token is the capability). */
export function verifyConnectorSignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signatureHeader.trim())
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}
function dateOnly(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  // Accept 'YYYY-MM-DD' or an ISO datetime; take the date part.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

// ── Mappers ────────────────────────────────────────────────────────────────

/** Generic: the documented normalized contract. Partners POST exactly this. */
function mapGeneric(p: Record<string, any>): NormalizedBooking {
  const members = Array.isArray(p.members)
    ? p.members.map((m: any) => ({ full_name: str(m.full_name ?? m.name) ?? undefined, email: str(m.email) ?? undefined }))
    : []
  return {
    externalRef: str(p.external_ref ?? p.booking_id ?? p.id),
    activityExternalId: str(p.activity_external_id ?? p.product_id),
    activityKey: str(p.activity_key),
    reservationDate: dateOnly(p.reservation_date ?? p.date ?? p.start_at),
    partySize: num(p.party_size ?? p.quantity),
    organizerName: str(p.organizer_name ?? p.customer_name),
    organizerEmail: str(p.organizer_email ?? p.customer_email),
    members,
  }
}

/** FareHarbor booking webhook (SCAFFOLD — validate field paths vs a real
 *  sandbox delivery). Their payload nests the booking under `booking`. */
function mapFareHarbor(p: Record<string, any>): NormalizedBooking {
  const b = p.booking ?? p
  const contact = b.contact ?? {}
  const item = b.availability?.item ?? b.item ?? {}
  const customers = Array.isArray(b.customers) ? b.customers : []
  return {
    externalRef: str(b.uuid ?? b.pk ?? b.display_id),
    activityExternalId: str(item.pk ?? item.id),
    activityKey: null,   // FareHarbor items map to a Liabl activity via activity_map
    reservationDate: dateOnly(b.availability?.start_at ?? b.start_at),
    partySize: num(b.customer_count ?? customers.length),
    organizerName: str(contact.name),
    organizerEmail: str(contact.email),
    members: customers
      .map((c: any) => ({ full_name: str(c.name ?? c?.customer_type_rate?.customer_prototype?.display_name) ?? undefined, email: str(c.email) ?? undefined }))
      .filter((m: any) => m.full_name || m.email),
  }
}

/** Peek Pro booking webhook (SCAFFOLD — validate field paths vs a real
 *  sandbox delivery). */
function mapPeek(p: Record<string, any>): NormalizedBooking {
  const b = p.booking ?? p.data ?? p
  const customer = b.customer ?? {}
  return {
    externalRef: str(b.id ?? b.booking_id ?? b.uuid),
    activityExternalId: str(b.product_id ?? b.activity_id),
    activityKey: null,
    reservationDate: dateOnly(b.date ?? b.start_date ?? b.start_time),
    partySize: num(b.party_size ?? b.quantity ?? b.number_of_guests),
    organizerName: str(customer.name ?? [customer.first_name, customer.last_name].filter(Boolean).join(' ')),
    organizerEmail: str(customer.email),
    members: [],
  }
}

export function mapBooking(type: ConnectorType, payload: Record<string, any>): NormalizedBooking {
  switch (type) {
    case 'fareharbor': return mapFareHarbor(payload)
    case 'peek':       return mapPeek(payload)
    default:           return mapGeneric(payload)
  }
}

/** Resolve the Liabl activity key for a booking: an explicit key on the
 *  payload wins, else the connector's activity_map by the engine's product id,
 *  else the connector's default. Null when none can be determined. */
export function resolveActivityKey(
  connector: { default_activity_key: string | null; activity_map: Record<string, string> | null },
  booking: NormalizedBooking,
): string | null {
  if (booking.activityKey) return booking.activityKey
  const map = connector.activity_map ?? {}
  if (booking.activityExternalId && map[booking.activityExternalId]) return map[booking.activityExternalId]
  return connector.default_activity_key || null
}
