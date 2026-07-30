'use client'
// Public API v1 — Phase B "Webhooks" area inside the Developers tab.
// Register HTTPS endpoints, choose which events they receive, and watch
// recent deliveries. A new endpoint's signing secret is shown ONCE here
// (generated server-side by /api/webhooks) and never again — receivers use
// it to verify the X-Liabl-Signature header on every delivery.
import { useState, useEffect, useCallback } from 'react'
import {
  listWebhookEndpoints, setWebhookEndpointActive, deleteWebhookEndpoint,
  listRecentDeliveries, redeliverDelivery, WEBHOOK_EVENT_OPTIONS,
  type WebhookEndpointRecord, type WebhookDeliveryRecord,
} from '@/lib/webhooks-client'

function fmtWhen(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_STYLE: Record<string, string> = {
  succeeded: 'text-green-600 border-green-200 bg-green-50',
  pending:   'text-amber-600 border-amber-200 bg-amber-50',
  failed:    'text-red-500 border-red-200 bg-red-50',
}

export default function WebhooksPanel({ operatorId }: { operatorId: string }) {
  const [endpoints, setEndpoints] = useState<WebhookEndpointRecord[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Create form
  const [creating, setCreating] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['waiver.signed'])

  // One-time secret reveal
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [eps, dels] = await Promise.all([
        listWebhookEndpoints(operatorId),
        listRecentDeliveries(operatorId, 25),
      ])
      setEndpoints(eps); setDeliveries(dels)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks')
    } finally { setLoading(false) }
  }, [operatorId])

  useEffect(() => { refresh() }, [refresh])

  function toggleEvent(ev: string) {
    setEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev])
  }

  async function handleCreate() {
    if (!url.trim() || events.length === 0) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), events }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Failed to create endpoint'); return }
      setNewSecret(body.secret)   // shown once
      setCreating(false); setUrl('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create endpoint')
    } finally { setBusy(false) }
  }

  async function handleToggle(ep: WebhookEndpointRecord) {
    setBusy(true)
    try { await setWebhookEndpointActive(ep.id, !ep.active); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update endpoint') }
    finally { setBusy(false) }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    try { await deleteWebhookEndpoint(id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete endpoint') }
    finally { setBusy(false) }
  }

  async function handleRedeliver(id: string) {
    setBusy(true)
    try { await redeliverDelivery(id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to queue redelivery') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-10 pt-8 border-t border-black/10">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Webhooks</h3>
          <p className="text-sm text-gray-500">
            We POST to your HTTPS endpoints the moment an event happens. Verify the{' '}
            <span className="font-mono text-ink">X-Liabl-Signature</span> header with the endpoint&apos;s signing secret.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-secondary text-sm shrink-0">
          {creating ? 'Close' : '+ Add endpoint'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* One-time secret reveal */}
      {newSecret && (
        <div className="card mb-6 border-brand/30 bg-brand/5">
          <div className="text-sm font-medium text-ink mb-1">Endpoint signing secret</div>
          <p className="text-xs text-gray-500 mb-3">Copy it now — for security it won&apos;t be shown again. Use it to verify every delivery&apos;s signature.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newSecret}</code>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(newSecret); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}
              className="btn-secondary text-sm shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <button onClick={() => setNewSecret(null)} className="text-xs text-gray-400 hover:text-gray-600 underline mt-3">I&apos;ve saved it — dismiss</button>
        </div>
      )}

      {creating && (
        <div className="card mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint URL (https)</label>
            <input className="form-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhooks/liabl" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Events</label>
            <div className="space-y-1.5">
              {WEBHOOK_EVENT_OPTIONS.map(o => (
                <label key={o.event} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={events.includes(o.event)} onChange={() => toggleEvent(o.event)} />
                  <span className="font-mono text-xs text-gray-500">{o.event}</span>
                  <span className="text-gray-400 text-xs">— {o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={busy || !url.trim() || events.length === 0} className="btn-primary text-sm">Add endpoint</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading webhooks…</div>
      ) : (
        <>
          <div className="space-y-2">
            {endpoints.length === 0 && <p className="text-sm text-gray-400">No webhook endpoints yet.</p>}
            {endpoints.map(ep => (
              <div key={ep.id} className={`card flex items-center gap-3 ${ep.active ? '' : 'opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink font-mono truncate">{ep.url}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ep.eventTypes.join(', ') || 'no events'} · last delivery {fmtWhen(ep.lastDeliveryAt)}
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wide border rounded px-1 shrink-0 ${ep.active ? 'text-green-600 border-green-200' : 'text-gray-400 border-black/10'}`}>
                  {ep.active ? 'Active' : 'Paused'}
                </span>
                <button onClick={() => handleToggle(ep)} disabled={busy} className="text-xs text-gray-400 hover:text-ink underline shrink-0">
                  {ep.active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => handleDelete(ep.id)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 underline shrink-0">Delete</button>
              </div>
            ))}
          </div>

          {deliveries.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Recent deliveries</div>
              <div className="space-y-1.5">
                {deliveries.map(d => (
                  <div key={d.id} className="flex items-center gap-3 text-xs border border-black/5 rounded-lg px-3 py-2">
                    <span className={`uppercase tracking-wide border rounded px-1 shrink-0 ${STATUS_STYLE[d.status] || 'text-gray-500 border-black/10'}`}>{d.status}</span>
                    <span className="font-mono text-gray-600 flex-1 min-w-0 truncate">{d.eventType}</span>
                    <span className="text-gray-400 shrink-0">
                      {d.attempts > 0 && `${d.attempts} attempt${d.attempts > 1 ? 's' : ''}`}
                      {d.lastStatusCode ? ` · ${d.lastStatusCode}` : ''}
                      {' · '}{fmtWhen(d.createdAt)}
                    </span>
                    {d.status !== 'succeeded' && (
                      <button onClick={() => handleRedeliver(d.id)} disabled={busy} className="text-gray-400 hover:text-ink underline shrink-0">Redeliver</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
