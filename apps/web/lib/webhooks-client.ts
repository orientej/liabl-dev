// lib/webhooks-client.ts
// Public API v1 — operator-console webhook management. Client-safe (no
// crypto, no service-role): list / toggle / delete endpoints and list /
// redeliver deliveries use the authenticated browser client, scoped by RLS
// (webhook_endpoints_manage_own, webhook_deliveries_*_own). ENDPOINT
// CREATION is NOT here — it generates the signing secret server-side, so it
// lives in the route handler app/api/webhooks/route.ts. This file never
// selects the endpoint `secret`.

import { createClient } from '@/lib/supabase'

// The subscribable events shown in the console. Kept here (not imported
// from lib/webhooks) so this stays client-safe — lib/webhooks is
// server-only. Keep in sync with WEBHOOK_EVENTS there.
export const WEBHOOK_EVENT_OPTIONS: { event: string; label: string }[] = [
  { event: 'waiver.signed',             label: 'Waiver signed (sealed PDF ready)' },
  { event: 'document.signed',           label: 'Supplemental document signed' },
  { event: 'reservation.member_signed', label: 'Reservation attendee checked in' },
  { event: 'reservation.completed',     label: 'Reservation fully checked in' },
]

export interface WebhookEndpointRecord {
  id:          string
  url:         string
  eventTypes:  string[]
  active:      boolean
  description: string | null
  lastDeliveryAt: string | null
  createdAt:   string
}

export interface WebhookDeliveryRecord {
  id:             string
  endpointId:     string
  eventType:      string
  status:         'pending' | 'succeeded' | 'failed'
  attempts:       number
  lastStatusCode: number | null
  lastError:      string | null
  nextAttemptAt:  string | null
  deliveredAt:    string | null
  createdAt:      string
}

export async function listWebhookEndpoints(operatorId: string): Promise<WebhookEndpointRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, url, event_types, active, description, last_delivery_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`list webhook endpoints: ${error.message}`)
  return (data ?? []).map(e => ({
    id: e.id, url: e.url, eventTypes: e.event_types ?? [], active: e.active,
    description: e.description ?? null, lastDeliveryAt: e.last_delivery_at ?? null, createdAt: e.created_at,
  }))
}

export async function setWebhookEndpointActive(id: string, active: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('webhook_endpoints').update({ active }).eq('id', id)
  if (error) throw new Error(`update webhook endpoint: ${error.message}`)
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
  if (error) throw new Error(`delete webhook endpoint: ${error.message}`)
}

export async function listRecentDeliveries(operatorId: string, limit = 25): Promise<WebhookDeliveryRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, status, attempts, last_status_code, last_error, next_attempt_at, delivered_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`list deliveries: ${error.message}`)
  return (data ?? []).map(d => ({
    id: d.id, endpointId: d.endpoint_id, eventType: d.event_type, status: d.status,
    attempts: d.attempts, lastStatusCode: d.last_status_code ?? null, lastError: d.last_error ?? null,
    nextAttemptAt: d.next_attempt_at ?? null, deliveredAt: d.delivered_at ?? null, createdAt: d.created_at,
  }))
}

/** Reset a delivery so the next dispatch run resends it (the dispatcher,
 *  service-role, does the actual POST). Allowed by webhook_deliveries_update_own. */
export async function redeliverDelivery(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({ status: 'pending', next_attempt_at: new Date().toISOString(), attempts: 0, last_error: null })
    .eq('id', id)
  if (error) throw new Error(`redeliver: ${error.message}`)
}
