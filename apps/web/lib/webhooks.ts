// lib/webhooks.ts
// Public API v1 — Phase B outbound webhooks. SERVER-ONLY (imports node
// crypto + the service-role client) — never import from a client
// component. The client-safe catalog/types + console helpers live in
// lib/webhooks-client.ts.
//
// Three jobs:
//   1. emitWebhookEvent()   — called from the server finish path (seal
//      write-back / member-complete). Inserts one durable webhook_deliveries
//      row per active endpoint subscribed to the event. Fire-and-forget:
//      it must never throw into the caller's response path.
//   2. signWebhookBody()    — Stripe-style HMAC signature so receivers can
//      verify a payload really came from Liabl.
//   3. dispatchDueDeliveries() — the cron dispatcher's core: POST every
//      pending, due delivery with the signature header, then mark
//      succeeded / schedule an exponential-backoff retry / give up.

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'

type AdminClient = ReturnType<typeof createAdminClient>

// The events a booking engine can subscribe to. waiver.signed is the
// headline signal (a participant finished + the PDF is sealed).
export const WEBHOOK_EVENTS = [
  'waiver.signed',
  'document.signed',
  'reservation.member_signed',
  'reservation.completed',
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/** A fresh HMAC signing secret for a new endpoint (shown once). */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`
}

/**
 * Stripe-style signature over `${timestamp}.${body}`. The receiver
 * recomputes HMAC-SHA256(secret, `${t}.${rawBody}`) and constant-time
 * compares it to v1. Including the timestamp lets them reject replays.
 * Returns the value for the `X-Liabl-Signature` header.
 */
export function signWebhookBody(secret: string, timestampSeconds: number, body: string): string {
  const signed = `${timestampSeconds}.${body}`
  const v1 = crypto.createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${timestampSeconds},v1=${v1}`
}

/**
 * Emit an event: fan it out into the durable outbox. Finds the operator's
 * ACTIVE endpoints subscribed to `eventType` and inserts a pending
 * delivery for each (the cron dispatcher sends them). No endpoints
 * subscribed → nothing happens. Wrapped so a failure here never breaks the
 * check-in that triggered it.
 */
export async function emitWebhookEvent(
  admin: AdminClient,
  params: { operatorId: string; eventType: WebhookEvent; data: Record<string, unknown> },
): Promise<void> {
  try {
    const { operatorId, eventType, data } = params
    const { data: endpoints } = await admin
      .from('webhook_endpoints')
      .select('id')
      .eq('operator_id', operatorId)
      .eq('active', true)
      .contains('event_types', [eventType])
    if (!endpoints || endpoints.length === 0) return

    const nowISO = new Date().toISOString()
    const rows = endpoints.map(e => ({
      endpoint_id: e.id,
      operator_id: operatorId,
      event_type: eventType,
      payload: buildEventEnvelope(eventType, data),
      status: 'pending',
      next_attempt_at: nowISO,
    }))
    await admin.from('webhook_deliveries').insert(rows)
  } catch {
    /* emission is best-effort — never surface into the caller's response */
  }
}

// The JSON envelope every webhook payload shares. event_id/created are
// filled from the delivery row at send time (see toWireBody); here we
// stamp type + data + an emitted timestamp.
function buildEventEnvelope(eventType: WebhookEvent, data: Record<string, unknown>): Record<string, unknown> {
  return { type: eventType, emitted_at: new Date().toISOString(), data }
}

// Exponential backoff between attempts: ~1m, 5m, 30m, 2h, 6h, then stop.
// attemptNumber is the attempt that just FAILED (1-based).
const BACKOFF_MINUTES = [1, 5, 30, 120, 360]
function nextAttemptISO(attemptNumber: number): string {
  const mins = BACKOFF_MINUTES[Math.min(attemptNumber, BACKOFF_MINUTES.length) - 1]
  return new Date(Date.now() + mins * 60_000).toISOString()
}

interface DeliveryRow {
  id: string
  endpoint_id: string
  event_type: string
  event_id: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  created_at: string
}

interface EndpointRow { id: string; url: string; secret: string; active: boolean }

/**
 * Send a single delivery now: sign, POST (10s timeout), then record the
 * outcome (succeeded / retry-scheduled / failed-permanently). Isolated so
 * one bad endpoint can't abort a whole dispatch batch. Returns the final
 * status for the batch summary.
 */
async function sendDelivery(admin: AdminClient, d: DeliveryRow, endpoint: EndpointRow): Promise<'succeeded' | 'retry' | 'failed'> {
  const attemptNo = d.attempts + 1
  // The exact bytes we sign are the exact bytes we send. payload already
  // carries { type, emitted_at, data }; prepend the stable delivery id +
  // created_at so the receiver has an idempotency key.
  const body = JSON.stringify({
    id: d.event_id,
    created_at: d.created_at,
    ...d.payload,
  })
  const ts = Math.floor(Date.now() / 1000)
  const signature = signWebhookBody(endpoint.secret, ts, body)

  let statusCode: number | null = null
  let errorText: string | null = null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-liabl-signature': signature,
        'x-liabl-event': d.event_type,
        'x-liabl-delivery': d.id,
        'user-agent': 'Liabl-Webhooks/1',
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    statusCode = res.status
    if (!res.ok) errorText = `HTTP ${res.status}`
  } catch (e) {
    errorText = e instanceof Error ? e.message : 'request failed'
  }

  const ok = statusCode !== null && statusCode >= 200 && statusCode < 300
  if (ok) {
    await admin.from('webhook_deliveries').update({
      status: 'succeeded', attempts: attemptNo, last_status_code: statusCode,
      last_error: null, delivered_at: new Date().toISOString(),
    }).eq('id', d.id)
    await admin.from('webhook_endpoints').update({ last_delivery_at: new Date().toISOString() }).eq('id', endpoint.id)
    return 'succeeded'
  }

  const exhausted = attemptNo >= d.max_attempts
  await admin.from('webhook_deliveries').update({
    status: exhausted ? 'failed' : 'pending',
    attempts: attemptNo,
    last_status_code: statusCode,
    last_error: errorText,
    next_attempt_at: exhausted ? null : nextAttemptISO(attemptNo),
  }).eq('id', d.id)
  return exhausted ? 'failed' : 'retry'
}

/**
 * Drain due deliveries. Selects up to `limit` pending rows whose
 * next_attempt_at has passed, loads their (still-active) endpoints, and
 * sends each. Deliveries whose endpoint was deleted or deactivated are
 * marked failed rather than retried forever. Returns a summary.
 */
export async function dispatchDueDeliveries(admin: AdminClient, limit = 50): Promise<{
  attempted: number; succeeded: number; retried: number; failed: number; skipped: number
}> {
  const nowISO = new Date().toISOString()
  const { data: due } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, payload, attempts, max_attempts, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowISO)
    .order('next_attempt_at', { ascending: true })
    .limit(limit)

  const deliveries = (due ?? []) as DeliveryRow[]
  const summary = { attempted: 0, succeeded: 0, retried: 0, failed: 0, skipped: 0 }
  if (deliveries.length === 0) return summary

  // Load the endpoints referenced by this batch in one query.
  const endpointIds = Array.from(new Set(deliveries.map(d => d.endpoint_id)))
  const { data: eps } = await admin
    .from('webhook_endpoints')
    .select('id, url, secret, active')
    .in('id', endpointIds)
  const endpointById = new Map<string, EndpointRow>()
  for (const e of (eps ?? []) as EndpointRow[]) endpointById.set(e.id, e)

  for (const d of deliveries) {
    const endpoint = endpointById.get(d.endpoint_id)
    if (!endpoint || !endpoint.active) {
      // Endpoint gone or paused — don't keep it pending forever.
      await admin.from('webhook_deliveries').update({
        status: 'failed', last_error: endpoint ? 'endpoint inactive' : 'endpoint deleted', next_attempt_at: null,
      }).eq('id', d.id)
      summary.skipped++
      continue
    }
    summary.attempted++
    const outcome = await sendDelivery(admin, d, endpoint)
    if (outcome === 'succeeded') summary.succeeded++
    else if (outcome === 'retry') summary.retried++
    else summary.failed++
  }

  return summary
}
