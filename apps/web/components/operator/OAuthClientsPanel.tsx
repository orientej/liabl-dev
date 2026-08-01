'use client'
// Public API — Phase D1 "OAuth clients" area inside the Developers tab. An
// alternative to static API keys: create a client (id + secret), then have
// your server exchange them at the token endpoint for a short-lived bearer
// token. The secret is shown ONCE here (generated server-side).
import { useState, useEffect, useCallback } from 'react'
import { listOAuthClients, revokeOAuthClient, type OAuthClientRecord } from '@/lib/oauth-client'
import { API_SCOPE_OPTIONS } from '@/lib/api-keys'

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OAuthClientsPanel({ operatorId }: { operatorId: string }) {
  const [clients, setClients] = useState<OAuthClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'live' | 'test'>('live')
  const [scopes, setScopes] = useState<string[]>(['reservations:read', 'reservations:write'])

  // One-time reveal of a new client's id + secret
  const [newCreds, setNewCreds] = useState<{ clientId: string; clientSecret: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setClients(await listOAuthClients(operatorId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load OAuth clients') }
    finally { setLoading(false) }
  }, [operatorId])

  useEffect(() => { refresh() }, [refresh])

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  async function handleCreate() {
    if (!name.trim() || scopes.length === 0) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/oauth/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes, mode }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Failed to create client'); return }
      setNewCreds({ clientId: body.clientId, clientSecret: body.clientSecret })
      setCreating(false); setName('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create client')
    } finally { setBusy(false) }
  }

  async function handleRevoke(id: string) {
    setBusy(true)
    try { await revokeOAuthClient(id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke client') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-10 pt-8 border-t border-black/10">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>OAuth clients</h3>
          <p className="text-sm text-gray-500">
            For server-to-server integrations that prefer OAuth2. Exchange the client id + secret at{' '}
            <span className="font-mono text-ink">POST https://api.liabl.ai/api/oauth/token</span>{' '}
            (<span className="font-mono text-ink">grant_type=client_credentials</span>) for a 1-hour bearer token, then call the API with it.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-secondary text-sm shrink-0">
          {creating ? 'Close' : '+ Create client'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* One-time credentials reveal */}
      {newCreds && (
        <div className="card mb-6 border-brand/30 bg-brand/5 space-y-3">
          <div className="text-sm font-medium text-ink">Your new OAuth client</div>
          <p className="text-xs text-gray-500">Copy the secret now — for security it won&apos;t be shown again.</p>
          <div>
            <div className="text-xs text-gray-500 mb-1">Client ID</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newCreds.clientId}</code>
              <button onClick={() => copy('id', newCreds.clientId)} className="btn-secondary text-sm shrink-0">{copied === 'id' ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Client secret</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-black/10 rounded-lg px-3 py-2 break-all">{newCreds.clientSecret}</code>
              <button onClick={() => copy('secret', newCreds.clientSecret)} className="btn-secondary text-sm shrink-0">{copied === 'secret' ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
          <button onClick={() => setNewCreds(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">I&apos;ve saved it — dismiss</button>
        </div>
      )}

      {creating && (
        <div className="card mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Partner server integration" />
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
          <button onClick={handleCreate} disabled={busy || !name.trim() || scopes.length === 0} className="btn-primary text-sm">Create client</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading OAuth clients…</div>
      ) : (
        <div className="space-y-2">
          {clients.length === 0 && <p className="text-sm text-gray-400">No OAuth clients yet.</p>}
          {clients.map(c => (
            <div key={c.id} className={`card flex items-center gap-3 ${c.revokedAt ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {c.name}
                  <span className="text-[10px] uppercase tracking-wide border border-black/10 rounded px-1 text-gray-500">{c.mode}</span>
                  {c.revokedAt && <span className="text-[10px] uppercase text-red-500 border border-red-200 rounded px-1">Revoked</span>}
                </div>
                <div className="text-xs text-gray-400 font-mono mt-0.5 truncate">{c.clientId}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.scopes.join(', ') || 'no scopes'} · created {fmtDate(c.createdAt)} · last used {fmtDate(c.lastUsedAt)}
                </div>
              </div>
              {!c.revokedAt && (
                <button onClick={() => handleRevoke(c.id)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 underline shrink-0">Revoke</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
