// lib/connectors-client.ts
// Public API — operator-console connector management. Client-safe (no crypto,
// no service-role): list / toggle / delete + recent events via the
// authenticated browser client, scoped by RLS. CREATION is NOT here (it
// generates the token + secret server-side, in app/api/connectors). This file
// never selects signing_secret.

import { createClient } from '@/lib/supabase'

// The connector-type catalog lives here (client-safe) so the console UI can
// import it without pulling in lib/connectors, which is server-only (node
// crypto). lib/connectors re-exports the ConnectorType from here.
export type ConnectorType = 'generic' | 'fareharbor' | 'peek'
export const CONNECTOR_TYPES: { type: ConnectorType; label: string }[] = [
  { type: 'generic',    label: 'Generic (normalized JSON)' },
  { type: 'fareharbor', label: 'FareHarbor' },
  { type: 'peek',       label: 'Peek Pro' },
]

export interface ConnectorRecord {
  id:                 string
  type:               string
  name:               string
  inboundToken:       string
  defaultActivityKey: string | null
  activityMap:        Record<string, string>
  mode:               'live' | 'test'
  active:             boolean
  lastEventAt:        string | null
  createdAt:          string
}

export interface ConnectorEventRecord {
  id:            string
  connectorId:   string
  status:        string
  externalRef:   string | null
  reservationId: string | null
  error:         string | null
  createdAt:     string
}

export async function listConnectors(operatorId: string): Promise<ConnectorRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('connectors')
    .select('id, type, name, inbound_token, default_activity_key, activity_map, mode, active, last_event_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`list connectors: ${error.message}`)
  return (data ?? []).map(c => ({
    id: c.id, type: c.type, name: c.name, inboundToken: c.inbound_token,
    defaultActivityKey: c.default_activity_key ?? null, activityMap: (c.activity_map ?? {}) as Record<string, string>,
    mode: c.mode, active: c.active, lastEventAt: c.last_event_at ?? null, createdAt: c.created_at,
  }))
}

export async function setConnectorActive(id: string, active: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('connectors').update({ active }).eq('id', id)
  if (error) throw new Error(`update connector: ${error.message}`)
}

export async function deleteConnector(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('connectors').delete().eq('id', id)
  if (error) throw new Error(`delete connector: ${error.message}`)
}

export async function listConnectorEvents(operatorId: string, limit = 25): Promise<ConnectorEventRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('connector_events')
    .select('id, connector_id, status, external_ref, reservation_id, error, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`list connector events: ${error.message}`)
  return (data ?? []).map(e => ({
    id: e.id, connectorId: e.connector_id, status: e.status, externalRef: e.external_ref ?? null,
    reservationId: e.reservation_id ?? null, error: e.error ?? null, createdAt: e.created_at,
  }))
}
