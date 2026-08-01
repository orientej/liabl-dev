'use client'
// Public API — Phase D3 "Booking connectors" area inside the Developers tab.
// Register an inbound connector for a booking engine (generic / FareHarbor /
// Peek); the engine POSTs bookings to the connector's URL and Liabl turns them
// into reservations. The signing secret is shown ONCE (generated server-side).
import { useState, useEffect, useCallback } from 'react'
import {
  listConnectors, setConnectorActive, deleteConnector, listConnectorEvents, CONNECTOR_TYPES,
  type ConnectorRecord, type ConnectorEventRecord,
} from '@/lib/connectors-client'

function fmtWhen(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_STYLE: Record<string, string> = {
  created:      'text-green-600 border-green-200 bg-green-50',
  ignored:      'text-amber-600 border-amber-200 bg-amber-50',
  unauthorized: 'text-red-500 border-red-200 bg-red-50',
  error:        'text-red-500 border-red-200 bg-red-50',
}

export default function ConnectorsPanel({ operatorId }: { operatorId: string }) {
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([])
  const [events, setEvents] = useState<ConnectorEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [creating, setCreating] = useState(false)
  const [type, setType] = useState('generic')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'live' | 'test'>('test')
  const [defaultActivityKey, setDefaultActivityKey] = useState('')

  const [newConn, setNewConn] = useState<{ inboundUrl: string; signingSecret: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cs, es] = await Promise.all([listConnectors(operatorId), listConnectorEvents(operatorId, 25)])
      setConnectors(cs); setEvents(es)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connectors')
    } finally { setLoading(false) }
  }, [operatorId])

  useEffect(() => { refresh() }, [refresh])

  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  async function handleCreate() {
    if (!name.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: name.trim(), mode, defaultActivityKey: defaultActivityKey.trim() || null }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Failed to create connector'); return }
      setNewConn({ inboundUrl: body.inboundUrl, signingSecret: body.signingSecret })
      setCreating(false); setName(''); setDefaultActivityKey('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create connector')
    } finally { setBusy(false) }
  }

  async function handleToggle(c: ConnectorRecord) {
    setBusy(true)
    try { await setConnectorActive(c.id, !c.active); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update connector') }
    finally { setBusy(false) }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    try { await deleteConnector(id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete connector') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-10 pt-8 border-t border-black/10">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Booking connectors</h3>
          <p className="text-sm text-gray-500">
            Let a booking engine create reservations automatically. Point its webhook at your connector URL; each booking
            becomes a reservation with check-in links. Use a <span className="font-mono text-ink">test</span> connector to trial it safely.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-secondary text-sm shrink-0">
          {creating ? 'Close' : '+ Add connector'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* One-time reveal */}
      {newConn && (
        <div className="card mb-6 border-brand/30 bg-brand/5 space-y-3">
          <div className="text-sm font-medium text-ink">Your new connector</div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Inbound URL (point the engine&apos;s webhook here)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newConn.inboundUrl}</code>
              <button onClick={() => copy('url', newConn.inboundUrl)} className="btn-secondary text-sm shrink-0">{copied === 'url' ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Signing secret (HMAC-SHA256 of the raw body → <span className="font-mono">X-Liabl-Connector-Signature</span>)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newConn.signingSecret}</code>
              <button onClick={() => copy('secret', newConn.signingSecret)} className="btn-secondary text-sm shrink-0">{copied === 'secret' ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Copy the secret now — it won&apos;t be shown again.</p>
          <button onClick={() => setNewConn(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">I&apos;ve saved it — dismiss</button>
        </div>
      )}

      {creating && (
        <div className="card mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Booking engine</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              {CONNECTOR_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Connector name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FareHarbor — main store" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Default activity key</label>
            <input className="form-input font-mono" value={defaultActivityKey} onChange={e => setDefaultActivityKey(e.target.value)} placeholder="e.g. zipline" />
            <p className="text-xs text-gray-400 mt-1">The Liabl activity a booking maps to when the payload doesn&apos;t specify one.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
            <div className="flex gap-2">
              {(['test', 'live'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-sm px-3 py-1.5 rounded-lg border ${mode === m ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 text-gray-500'}`}>
                  {m === 'live' ? 'Live' : 'Test'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={busy || !name.trim()} className="btn-primary text-sm">Add connector</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading connectors…</div>
      ) : (
        <>
          <div className="space-y-2">
            {connectors.length === 0 && <p className="text-sm text-gray-400">No connectors yet.</p>}
            {connectors.map(c => (
              <div key={c.id} className={`card flex items-center gap-3 ${c.active ? '' : 'opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] uppercase tracking-wide border border-black/10 rounded px-1 text-gray-500">{c.type}</span>
                    <span className="text-[10px] uppercase tracking-wide border border-black/10 rounded px-1 text-gray-500">{c.mode}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5 truncate">/api/connectors/{c.inboundToken}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {c.defaultActivityKey ? `default: ${c.defaultActivityKey}` : 'no default activity'} · last event {fmtWhen(c.lastEventAt)}
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wide border rounded px-1 shrink-0 ${c.active ? 'text-green-600 border-green-200' : 'text-gray-400 border-black/10'}`}>
                  {c.active ? 'Active' : 'Paused'}
                </span>
                <button onClick={() => handleToggle(c)} disabled={busy} className="text-xs text-gray-400 hover:text-ink underline shrink-0">{c.active ? 'Pause' : 'Resume'}</button>
                <button onClick={() => handleDelete(c.id)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 underline shrink-0">Delete</button>
              </div>
            ))}
          </div>

          {events.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Recent inbound bookings</div>
              <div className="space-y-1.5">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 text-xs border border-black/5 rounded-lg px-3 py-2">
                    <span className={`uppercase tracking-wide border rounded px-1 shrink-0 ${STATUS_STYLE[ev.status] || 'text-gray-500 border-black/10'}`}>{ev.status}</span>
                    <span className="font-mono text-gray-600 flex-1 min-w-0 truncate">{ev.externalRef || (ev.error ?? '—')}</span>
                    <span className="text-gray-400 shrink-0">{fmtWhen(ev.createdAt)}</span>
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
