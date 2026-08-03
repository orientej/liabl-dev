// lib/offline-store.ts
// On-site check-in PWA — P1b offline store (IndexedDB), dependency-free.
// Two jobs:
//   * engine cache — the operator's resolved config for a session, cached
//     while online so the check-in flow can still RENDER offline.
//   * outbox — completed check-ins signed while offline, drained by
//     lib/offline-sync once connectivity returns (idempotent on waiverId).
// All calls are browser-only and best-effort: any IndexedDB failure degrades
// to "no cache / empty outbox" rather than throwing into the flow.

import type { EngineData, ParticipantAnswers, WaiverClause } from '@/lib/document-engine'

const DB_NAME = 'liabl-checkin'
const DB_VERSION = 1
const ENGINE_STORE = 'engine'
const OUTBOX_STORE = 'outbox'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(ENGINE_STORE)) db.createObjectStore(ENGINE_STORE)
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'waiverId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = op(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }))
}

// ── Engine cache ────────────────────────────────────────────────────────────

export interface CachedEngine { engineData: EngineData; cachedAt: number }

export async function putEngine(sessionKey: string, value: CachedEngine): Promise<void> {
  try { await run(ENGINE_STORE, 'readwrite', s => s.put(value, sessionKey)) } catch { /* best-effort */ }
}

export async function getEngine(sessionKey: string): Promise<CachedEngine | null> {
  try { return (await run<CachedEngine | undefined>(ENGINE_STORE, 'readonly', s => s.get(sessionKey))) ?? null }
  catch { return null }
}

// ── Outbox (offline-signed check-ins) ───────────────────────────────────────

export interface QueuedCheckIn {
  waiverId:       string
  operatorId:     string
  operatorName:   string
  sessionId:      string           // raw session param; resolved to a real id at sync
  activityKey:    string
  activityLabel:  string
  answers:        ParticipantAnswers
  clauses:        WaiverClause[]
  signatureData:  string
  signedAt:       string           // captured at the actual offline signing moment
  ipAddress:      string | null
  reservationId:  string | null
  memberToken:    string | null
  marketingEmailConsent: boolean
  marketingSmsConsent:   boolean
  phone:          string | null
  queuedAt:       number
}

export async function enqueue(item: QueuedCheckIn): Promise<void> {
  await run(OUTBOX_STORE, 'readwrite', s => s.put(item))
}

export async function listOutbox(): Promise<QueuedCheckIn[]> {
  try { return (await run<QueuedCheckIn[]>(OUTBOX_STORE, 'readonly', s => s.getAll())) ?? [] }
  catch { return [] }
}

export async function removeFromOutbox(waiverId: string): Promise<void> {
  try { await run(OUTBOX_STORE, 'readwrite', s => s.delete(waiverId)) } catch { /* best-effort */ }
}

export async function outboxCount(): Promise<number> {
  try { return (await run<number>(OUTBOX_STORE, 'readonly', s => s.count())) ?? 0 }
  catch { return 0 }
}
