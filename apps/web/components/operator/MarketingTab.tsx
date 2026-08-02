'use client'
// Marketing automation — M3 console. Turn marketing on, see the audience you're
// capturing consent for, broadcast to it (email via Resend, SMS via Twilio), and
// run set-and-forget automations (thank-you, win-back). Built-in stays basic;
// volume/complex work goes to a 3rd-party platform via the contacts API + the
// marketing.contact webhook.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { fetchEngineData } from '@/lib/document-engine'
import {
  listMarketingContacts, setMarketingEnabled, contactsToCsv, listCampaigns,
  type MarketingContact, type CampaignRecord,
} from '@/lib/marketing-client'
import AutomationsPanel from '@/components/operator/AutomationsPanel'

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLE: Record<string, string> = {
  sent:    'border-green-200 text-green-600',
  sending: 'border-amber-200 text-amber-600',
  queued:  'border-blue-200 text-blue-600',
  failed:  'border-red-200 text-red-600',
  draft:   'border-black/10 text-gray-400',
}

export default function MarketingTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [contacts, setContacts] = useState<MarketingContact[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Compose state
  const [cName, setCName] = useState('')
  const [cChannel, setCChannel] = useState<'email' | 'sms'>('email')
  const [cSubject, setCSubject] = useState('')
  const [cBody, setCBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendNote, setSendNote] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account for your login.')
      setOperatorId(member.operatorId)
      const { createClient } = await import('@/lib/supabase')
      const engine = await fetchEngineData(createClient())
      setEnabled(engine.marketingEnabled)
      if (engine.marketingEnabled) {
        const [cts, cmps] = await Promise.all([
          listMarketingContacts(member.operatorId),
          listCampaigns(member.operatorId),
        ])
        setContacts(cts); setCampaigns(cmps)
      }
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

  async function sendCampaign() {
    setSending(true); setError(null); setSendNote(null)
    try {
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: cName.trim(), channel: cChannel,
          subject: cChannel === 'email' ? cSubject.trim() : null,
          body: cBody.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to queue campaign.')
      setSendNote(`Queued to ${json.audienceCount} ${cChannel === 'email' ? 'email' : 'SMS'} recipient${json.audienceCount === 1 ? '' : 's'}. Sending starts within a minute.`)
      setCName(''); setCSubject(''); setCBody('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to queue campaign')
    } finally { setSending(false) }
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
            confirmation. You&apos;ll build an audience here, and can broadcast to it or sync it to your own marketing
            platform.
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

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="card">
              <h3 className="font-medium text-ink mb-1">New broadcast</h3>
              <p className="text-xs text-gray-500 mb-4">
                Send a one-off message to everyone opted in to this channel. Recipients are frozen when you send, an
                unsubscribe link (and STOP for text) is added automatically, and delivery starts within a minute.
              </p>

              <div className="flex gap-2 mb-3">
                {(['email', 'sms'] as const).map(ch => {
                  const n = ch === 'email' ? emailCount : smsCount
                  return (
                    <button key={ch} type="button" onClick={() => setCChannel(ch)}
                      className={`flex-1 text-sm rounded-xl border px-3 py-2 ${cChannel === ch ? 'border-brand text-brand bg-brand/5' : 'border-black/10 text-gray-500'}`}>
                      {ch === 'email' ? 'Email' : 'Text'} <span className="text-xs opacity-60">· {n}</span>
                    </button>
                  )
                })}
              </div>

              <input className="form-input w-full mb-2" value={cName} onChange={e => setCName(e.target.value)}
                placeholder="Campaign name (internal)" maxLength={120} />

              {cChannel === 'email' && (
                <input className="form-input w-full mb-2" value={cSubject} onChange={e => setCSubject(e.target.value)}
                  placeholder="Subject line" maxLength={200} />
              )}

              <textarea className="form-input w-full mb-1" rows={cChannel === 'sms' ? 4 : 6} value={cBody}
                onChange={e => setCBody(e.target.value)}
                placeholder={cChannel === 'email' ? 'Write your email…' : 'Write your text message…'} />
              {cChannel === 'sms' && (
                <p className="text-[11px] text-gray-400 mb-2">{cBody.length} characters · “Reply STOP to opt out.” is appended automatically.</p>
              )}

              {sendNote && <div className="mb-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-2 text-xs">{sendNote}</div>}

              <button onClick={sendCampaign}
                disabled={sending || !cName.trim() || !cBody.trim() || (cChannel === 'email' && !cSubject.trim()) || (cChannel === 'email' ? emailCount : smsCount) === 0}
                className="btn-primary text-sm w-full mt-1">
                {sending ? 'Queuing…' : `Send to ${cChannel === 'email' ? emailCount : smsCount} ${cChannel === 'email' ? 'email' : 'SMS'} subscriber${(cChannel === 'email' ? emailCount : smsCount) === 1 ? '' : 's'}`}
              </button>
              <p className="text-[11px] text-gray-400 mt-3">
                Built-in broadcasts stay modest by design. For large volume, scheduling, segmentation, or A/B testing,
                sync your audience to a platform like Mailchimp or Klaviyo via the contacts API.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-ink mb-3">Recent broadcasts</h3>
              {campaigns.length === 0 ? (
                <div className="card text-sm text-gray-400">No broadcasts yet.</div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <div key={c.id} className="card py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm text-ink truncate">{c.name}</div>
                          <div className="text-xs text-gray-400">
                            {c.channel === 'email' ? 'Email' : 'Text'} · {fmtDate(c.sentAt ?? c.createdAt)}
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase border rounded px-1.5 py-0.5 shrink-0 ${STATUS_STYLE[c.status] ?? 'border-black/10 text-gray-400'}`}>{c.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {c.sentCount}/{c.audienceCount} sent{c.failedCount > 0 && <span className="text-red-500"> · {c.failedCount} failed</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <AutomationsPanel operatorId={operatorId!} emailCount={emailCount} smsCount={smsCount} smsAvailable={true} />
        </>
      )}
    </div>
  )
}
