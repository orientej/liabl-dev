'use client'
// Group reservations — organizer self-service page. Public, no login: the
// person who owns the booking manages their party via the reservation's
// self_service_token (in the URL). All data + actions go through the
// token-gated admin-client route /api/reservations/manage — this page never
// queries Supabase directly. Lives on the participant host.
import { useState, useEffect, useCallback } from 'react'
import { Logo } from '@liabl/ui'

interface MemberView {
  id: string
  fullName: string | null
  email: string | null
  status: 'invited' | 'signed'
  invitedAt: string | null
  checkInUrl: string
}
interface ManageData {
  reservation: {
    activityLabel: string
    operatorName: string
    reservationDate: string | null
    partySize: number | null
    organizerName: string | null
    status: 'open' | 'complete' | 'cancelled'
  }
  members: MemberView[]
  signedCount: number
  expectedCount: number
}

function Copy({ text }: { text: string }) {
  const [c, setC] = useState(false)
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1500) } catch {} }}
      className="text-xs px-2 py-1 rounded-lg border border-black/10 text-gray-600 hover:border-black/20 hover:text-ink shrink-0">
      {c ? 'Copied!' : 'Copy link'}
    </button>
  )
}

export default function OrganizerSelfServicePage({ params }: { params: { token: string } }) {
  const token = params.token
  const [data, setData] = useState<ManageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/reservations/manage?token=${encodeURIComponent(token)}`)
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'This reservation link could not be opened.'); setData(null) }
      else setData(body)
    } catch {
      setError('Something went wrong loading this reservation.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  async function action(payload: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/reservations/manage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      })
      const body = await res.json()
      if (!res.ok) setError(body.error || 'That action failed.')
      await load()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="h-14 bg-white border-b border-black/10 flex items-center px-5">
        <Logo />
      </div>
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {loading ? (
            <div className="card animate-pulse"><div className="h-6 bg-black/5 rounded w-2/3 mb-3" /><div className="h-4 bg-black/5 rounded w-full" /></div>
          ) : error && !data ? (
            <div className="card text-center">
              <h2 className="font-serif text-xl mb-2" style={{ letterSpacing: '-0.01em' }}>Can&apos;t open this reservation</h2>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          ) : data ? (
            <>
              <div className="card mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-1">Your group booking</p>
                    <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>{data.reservation.activityLabel}</h1>
                    <p className="text-sm text-gray-500">
                      {data.reservation.operatorName}{data.reservation.reservationDate ? ` · ${data.reservation.reservationDate}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-brand">{data.signedCount}/{data.expectedCount || '?'}</div>
                    <div className="text-xs text-gray-400">signed</div>
                  </div>
                </div>
                {data.reservation.status === 'cancelled' && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5 text-sm">This reservation has been cancelled.</div>
                )}
                {data.reservation.status === 'complete' && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-2.5 text-sm">Everyone&apos;s signed — you&apos;re all set. 🎉</div>
                )}
              </div>

              {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

              <div className="card">
                <p className="text-sm text-gray-500 mb-4">
                  Add each person coming and send them a link to complete their waiver before the event.
                </p>

                <div className="space-y-2 mb-4">
                  {data.members.length === 0 && <p className="text-xs text-gray-400">No attendees added yet.</p>}
                  {data.members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-sm border-b border-black/5 pb-2 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-ink truncate">{m.fullName || m.email || 'Attendee'}</div>
                        <div className="text-xs text-gray-400">
                          {m.email || 'no email'} ·{' '}
                          {m.status === 'signed'
                            ? <span className="text-emerald-600 font-medium">signed ✓</span>
                            : m.invitedAt ? 'invited' : 'not invited yet'}
                        </div>
                      </div>
                      <Copy text={m.checkInUrl} />
                      {m.status !== 'signed' && m.email && (
                        <button onClick={() => action({ action: 'send_invite', memberId: m.id })} disabled={busy}
                          className="text-xs px-2 py-1 rounded-lg border border-brand/30 text-brand hover:bg-brand/5 shrink-0">
                          {m.invitedAt ? 'Resend' : 'Send invite'}
                        </button>
                      )}
                      {m.status !== 'signed' && (
                        <button onClick={() => action({ action: 'remove_member', memberId: m.id })} disabled={busy}
                          className="text-xs text-gray-400 hover:text-red-500 shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                </div>

                {data.reservation.status === 'open' && (
                  <div className="border-t border-black/5 pt-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input className="form-input text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
                      <input className="form-input text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@address.com" />
                    </div>
                    <div className="flex gap-2">
                      <button disabled={busy || (!name.trim() && !email.trim())}
                        onClick={() => { action({ action: 'add_member', fullName: name, email }); setName(''); setEmail('') }}
                        className="btn-secondary text-sm">Add attendee</button>
                      <button disabled={busy || !email.trim()}
                        onClick={() => { action({ action: 'add_member', fullName: name, email, sendInvite: true }); setName(''); setEmail('') }}
                        className="btn-primary text-sm">Add + send invite</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
