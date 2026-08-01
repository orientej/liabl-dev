'use client'
// Marketing automation — M1 console. Turn marketing on, then see the audience
// you're capturing consent for. Built-in stays basic (consent + contacts now;
// broadcasts + automations next); volume/complex work goes to a 3rd-party
// platform via the contacts API + the marketing.contact webhook.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { fetchEngineData } from '@/lib/document-engine'
import { listMarketingContacts, setMarketingEnabled, contactsToCsv, type MarketingContact } from '@/lib/marketing-client'

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MarketingTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [contacts, setContacts] = useState<MarketingContact[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account for your login.')
      setOperatorId(member.operatorId)
      const { createClient } = await import('@/lib/supabase')
      const engine = await fetchEngineData(createClient())
      setEnabled(engine.marketingEnabled)
      if (engine.marketingEnabled) setContacts(await listMarketingContacts(member.operatorId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketing')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function toggleEnabled(next: boolean) {
    if (!operatorId) return
    setBusy(true); setError(null)
    try { await setMarketingEnabled(operatorId, next); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update setting') }
    finally { setBusy(false) }
  }

  function exportCsv() {
    const csv = contactsToCsv(contacts)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'liabl-marketing-contacts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="text-sm text-gray-500">Loading marketing…</div>

  const filtered = contacts.filter(c => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return c.email.toLowerCase().includes(q) || (c.fullName ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q)
  })
  const emailCount = contacts.filter(c => c.emailConsent && !c.unsubscribedEmail).length
  const smsCount = contacts.filter(c => c.smsConsent && !c.unsubscribedSms).length

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Marketing</h2>
        <p className="text-sm text-gray-500">
          Capture opt-in consent at check-in and build a marketing audience. Built-in marketing stays simple —
          for advanced segmentation, sequences, or high volume, sync your contacts to a platform like Mailchimp or
          Klaviyo via the contacts API and the <span className="font-mono text-ink">marketing.contact</span> webhook (see Developers).
        </p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {!enabled ? (
        <div className="card max-w-xl">
          <h3 className="font-medium text-ink mb-1">Turn on marketing</h3>
          <p className="text-sm text-gray-500 mb-4">
            When on, participants can opt in to marketing email and text at check-in — separately from their waiver
            confirmation. You&apos;ll build an audience here, and can broadcast to it (coming soon) or sync it to your
            own marketing platform.
          </p>
          <button onClick={() => toggleEnabled(true)} disabled={busy} className="btn-primary text-sm" style={{ maxWidth: 200 }}>
            {busy ? 'Enabling…' : 'Enable marketing'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="card flex-1 py-3"><div className="text-2xl font-bold text-brand">{emailCount}</div><div className="text-xs text-gray-400">email subscribers</div></div>
            <div className="card flex-1 py-3"><div className="text-2xl font-bold text-brand">{smsCount}</div><div className="text-xs text-gray-400">SMS subscribers</div></div>
            <div className="card flex-1 py-3"><div className="text-2xl font-bold text-ink">{contacts.length}</div><div className="text-xs text-gray-400">total contacts</div></div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input className="form-input flex-1" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, or phone…" />
            <button onClick={exportCsv} disabled={contacts.length === 0} className="btn-secondary text-sm shrink-0">Export CSV</button>
            <button onClick={() => toggleEnabled(false)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 underline shrink-0">Turn off</button>
          </div>

          <div className="border border-black/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-gray-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Name</th>
                  <th className="text-left font-medium px-3 py-2">Email</th>
                  <th className="text-left font-medium px-3 py-2">Phone</th>
                  <th className="text-left font-medium px-3 py-2">Consent</th>
                  <th className="text-left font-medium px-3 py-2">Since</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">{contacts.length === 0 ? 'No opted-in contacts yet.' : 'No matches.'}</td></tr>
                )}
                {filtered.map(c => (
                  <tr key={c.email} className="border-t border-black/5">
                    <td className="px-3 py-2 text-ink">{c.fullName ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.email}</td>
                    <td className="px-3 py-2 text-gray-600">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2">
                      {c.emailConsent && !c.unsubscribedEmail && <span className="text-[10px] uppercase border border-green-200 text-green-600 rounded px-1 mr-1">email</span>}
                      {c.smsConsent && !c.unsubscribedSms && <span className="text-[10px] uppercase border border-green-200 text-green-600 rounded px-1">sms</span>}
                      {c.unsubscribedEmail && <span className="text-[10px] uppercase border border-black/10 text-gray-400 rounded px-1 mr-1">email off</span>}
                      {c.unsubscribedSms && <span className="text-[10px] uppercase border border-black/10 text-gray-400 rounded px-1">sms off</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-4">Broadcasts and automations are coming next. In the meantime, sync this audience to your marketing platform via the contacts API.</p>
        </>
      )}
    </div>
  )
}
