'use client'
// Public API v1 — operator "Developers" area: create, view, and revoke API
// keys for the /api/v1 surface (booking engines & third-party developers).
// A freshly created key's plaintext is shown ONCE here and never again.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { listApiKeys, revokeApiKey, API_SCOPE_OPTIONS, type ApiKeyRecord } from '@/lib/api-keys'
import WebhooksPanel from '@/components/operator/WebhooksPanel'

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DevelopersTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Create form
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'live' | 'test'>('live')
  const [scopes, setScopes] = useState<string[]>(['reservations:read', 'reservations:write'])

  // The one-time reveal of a newly created key
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account for your login.')
      setOperatorId(member.operatorId)
      setKeys(await listApiKeys(member.operatorId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load API keys')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleCreate() {
    if (!name.trim() || scopes.length === 0) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes, mode }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Failed to create key'); return }
      setNewKey(body.key)   // shown once
      setCreating(false); setName('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key')
    } finally { setBusy(false) }
  }

  async function handleRevoke(id: string) {
    setBusy(true)
    try { await revokeApiKey(id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke key') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading API keys…</div>

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Developers</h2>
          <p className="text-sm text-gray-500">
            API keys for booking engines and integrations. Base URL: <span className="font-mono text-ink">https://api.liabl.ai/api/v1</span>.
            Send a key as <span className="font-mono text-ink">Authorization: Bearer &lt;key&gt;</span>.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-primary text-sm shrink-0">
          {creating ? 'Close' : '+ Create API key'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* One-time key reveal */}
      {newKey && (
        <div className="card mb-6 border-brand/30 bg-brand/5">
          <div className="text-sm font-medium text-ink mb-1">Your new API key</div>
          <p className="text-xs text-gray-500 mb-3">Copy it now — for security it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newKey}</code>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}
              className="btn-secondary text-sm shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-gray-400 hover:text-gray-600 underline mt-3">I&apos;ve saved it — dismiss</button>
        </div>
      )}

      {creating && (
        <div className="card mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Key name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FareHarbor integration" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
            <div className="flex gap-2">
              {(['live', 'test'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-sm px-3 py-1.5 rounded-lg border ${mode === m ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 text-gray-500'}`}>
                  {m === 'live' ? 'Live' : 'Test'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scopes (least privilege)</label>
            <div className="space-y-1.5">
              {API_SCOPE_OPTIONS.map(o => (
                <label key={o.scope} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={scopes.includes(o.scope)} onChange={() => toggleScope(o.scope)} />
                  <span className="font-mono text-xs text-gray-500">{o.scope}</span>
                  <span className="text-gray-400 text-xs">— {o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={busy || !name.trim() || scopes.length === 0} className="btn-primary text-sm">Create key</button>
        </div>
      )}

      <div className="space-y-2">
        {keys.length === 0 && <p className="text-sm text-gray-400">No API keys yet.</p>}
        {keys.map(k => (
          <div key={k.id} className={`card flex items-center gap-3 ${k.revokedAt ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink flex items-center gap-2">
                {k.name}
                <span className="text-[10px] uppercase tracking-wide border border-black/10 rounded px-1 text-gray-500">{k.mode}</span>
                {k.revokedAt && <span className="text-[10px] uppercase text-red-500 border border-red-200 rounded px-1">Revoked</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">{k.keyPrefix}…{k.last4}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {k.scopes.join(', ') || 'no scopes'} · created {fmtDate(k.createdAt)} · last used {fmtDate(k.lastUsedAt)}
              </div>
            </div>
            {!k.revokedAt && (
              <button onClick={() => handleRevoke(k.id)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 underline shrink-0">Revoke</button>
            )}
          </div>
        ))}
      </div>

      {operatorId && <WebhooksPanel operatorId={operatorId} />}
    </div>
  )
}
