'use client'
// Group reservations — operator console. Create a reservation for a party,
// invite attendees (personal links) so they complete their waiver before
// the event, hand the organizer a self-service link to manage their own
// party, and watch "X of N signed" progress. Phase 1 binds each reservation
// to an auto-created session so the whole existing check-in machinery is
// reused.
import { useState, useEffect, useCallback } from 'react'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { getCurrentOperatorMember } from '@/lib/auth'
import { createSession } from '@/lib/sessions'
import {
  listReservations, createReservation, listReservationMembers, addReservationMember,
  removeReservationMember, setReservationStatus,
  type ReservationRecord, type ReservationMemberRecord,
} from '@/lib/reservations'
import {
  reservationSelfServiceUrl, reservationCheckInUrl, reservationMemberCheckInUrl,
} from '@/lib/participant-url'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }}
      className="text-xs px-2 py-1 rounded-lg border border-black/10 text-gray-600 hover:border-black/20 hover:text-ink shrink-0">
      {copied ? 'Copied!' : label}
    </button>
  )
}

export default function ReservationsTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [operatorUserId, setOperatorUserId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [reservations, setReservations] = useState<ReservationRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<ReservationMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Create form
  const [creating, setCreating] = useState(false)
  const [fActivity, setFActivity] = useState('')
  const [fDate, setFDate] = useState(todayISO())
  const [fParty, setFParty] = useState('')
  const [fOrgName, setFOrgName] = useState('')
  const [fOrgEmail, setFOrgEmail] = useState('')

  // Add-member form
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')

  const selected = reservations.find(r => r.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account found for your login.')
      setOperatorId(member.operatorId)
      setOperatorUserId(member.userId ?? null)
      const { createClient } = await import('@/lib/supabase')
      const engine = await fetchEngineData(createClient(), undefined, { includeUnpublished: true })
      setActivities(engine.activities)
      if (!fActivity && engine.activities[0]) setFActivity(engine.activities[0].key)
      setReservations(await listReservations(member.operatorId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reservations')
    } finally { setLoading(false) }
  }, [fActivity])

  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMembers = useCallback(async (reservationId: string) => {
    try { setMembers(await listReservationMembers(reservationId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load attendees') }
  }, [])

  useEffect(() => { if (selectedId) loadMembers(selectedId) }, [selectedId, loadMembers])

  async function handleCreate() {
    if (!operatorId || !fActivity) return
    setBusy(true); setError(null)
    try {
      // Auto-create a session for this reservation's activity/date, then
      // bind the reservation to it — the operator never touches sessions.
      const sessionId = await createSession({
        operatorId,
        sessionRef: `Group: ${fOrgName.trim() || 'Reservation'}`,
        sessionTime: '',
        sessionDate: fDate,
        activityKey: fActivity,
      })
      const { id } = await createReservation({
        operatorId,
        activityKey: fActivity,
        sessionId,
        reservationDate: fDate,
        partySize: fParty ? Number(fParty) : null,
        organizerName: fOrgName.trim() || null,
        organizerEmail: fOrgEmail.trim() || null,
        createdByUserId: operatorUserId,
      })
      setCreating(false)
      setFParty(''); setFOrgName(''); setFOrgEmail('')
      await refresh()
      setSelectedId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create reservation')
    } finally { setBusy(false) }
  }

  async function handleAddMember(sendInvite: boolean) {
    if (!selected || !operatorId) return
    if (!mName.trim() && !mEmail.trim()) return
    setBusy(true); setError(null)
    try {
      const { id } = await addReservationMember(selected.id, operatorId, { fullName: mName, email: mEmail })
      setMName(''); setMEmail('')
      if (sendInvite && mEmail.trim()) {
        await fetch(`/api/reservations/${selected.id}/send-invites`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberIds: [id] }),
        })
      }
      await loadMembers(selected.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add attendee')
    } finally { setBusy(false) }
  }

  async function handleSendInvite(memberId: string) {
    if (!selected) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/reservations/${selected.id}/send-invites`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: [memberId] }),
      })
      const body = await res.json()
      if (!res.ok || (body.errors && body.errors.length)) {
        setError((body.errors && body.errors[0]) || body.error || 'Invite failed to send.')
      }
      await loadMembers(selected.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invite')
    } finally { setBusy(false) }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selected) return
    setBusy(true)
    try { await removeReservationMember(memberId); await loadMembers(selected.id); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove attendee') }
    finally { setBusy(false) }
  }

  async function handleCancel() {
    if (!selected) return
    setBusy(true)
    try { await setReservationStatus(selected.id, 'cancelled'); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to cancel') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading reservations…</div>

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Group reservations</h2>
          <p className="text-sm text-gray-500">
            Book a party, invite attendees to complete their waivers before the event, and track who&apos;s signed.
          </p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-primary text-sm shrink-0">
          {creating ? 'Close' : '+ New reservation'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {creating && (
        <div className="card mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Activity</label>
              <select className="form-input" value={fActivity} onChange={e => setFActivity(e.target.value)}>
                {activities.map(a => <option key={a.id} value={a.key}>{a.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" className="form-input" value={fDate} onChange={e => setFDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected party size</label>
              <input type="number" min="1" className="form-input" value={fParty} onChange={e => setFParty(e.target.value)} placeholder="e.g. 8" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Organizer name</label>
              <input className="form-input" value={fOrgName} onChange={e => setFOrgName(e.target.value)} placeholder="Party organizer" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Organizer email</label>
              <input type="email" className="form-input" value={fOrgEmail} onChange={e => setFOrgEmail(e.target.value)} placeholder="organizer@email.com" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={busy || !fActivity} className="btn-primary text-sm">Create reservation</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* List */}
        <div className="md:col-span-1 space-y-2">
          {reservations.length === 0 && <p className="text-sm text-gray-400">No reservations yet.</p>}
          {reservations.map(r => {
            const activity = activities.find(a => a.key === r.activityKey)
            return (
              <button key={r.id} onClick={() => setSelectedId(r.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  selectedId === r.id ? 'border-brand bg-brand/5' : 'border-black/10 hover:border-black/20'
                } ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {r.organizerName || 'Group reservation'}
                  {r.status === 'cancelled' && <span className="text-[10px] uppercase text-gray-400 border border-black/10 rounded px-1">Cancelled</span>}
                  {r.status === 'complete' && <span className="text-[10px] uppercase text-emerald-600 border border-emerald-200 rounded px-1">Complete</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {activity?.displayName ?? r.activityKey}{r.reservationDate ? ` · ${r.reservationDate}` : ''} · {r.signedCount}/{r.expectedCount || '?'} signed
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="card text-sm text-gray-500">Select a reservation, or create one.</div>
          ) : (
            <div className="card space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium text-ink">{selected.organizerName || 'Group reservation'}</div>
                  <div className="text-xs text-gray-500">
                    {activities.find(a => a.key === selected.activityKey)?.displayName ?? selected.activityKey}
                    {selected.reservationDate ? ` · ${selected.reservationDate}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-brand">{selected.signedCount}/{selected.expectedCount || '?'}</div>
                  <div className="text-xs text-gray-400">signed</div>
                </div>
              </div>

              {/* Shareable links */}
              <div className="space-y-2 border-t border-black/5 pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-gray-500">Organizer self-service link (hand this to the party organizer)</div>
                  <CopyButton text={reservationSelfServiceUrl(selected.selfServiceToken)} label="Copy" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-gray-500">Shared check-in link / QR (walk-ups)</div>
                  <CopyButton text={reservationCheckInUrl(selected.id)} label="Copy" />
                </div>
              </div>

              {/* Attendees */}
              <div className="border-t border-black/5 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Attendees</div>
                <div className="space-y-2 mb-3">
                  {members.length === 0 && <p className="text-xs text-gray-400">No attendees added yet.</p>}
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="text-ink truncate">{m.fullName || m.email || 'Attendee'}</div>
                        <div className="text-xs text-gray-400">
                          {m.email || 'no email'} ·{' '}
                          {m.status === 'signed'
                            ? <span className="text-emerald-600">signed</span>
                            : m.invitedAt ? 'invited' : 'not invited'}
                        </div>
                      </div>
                      <CopyButton text={reservationMemberCheckInUrl(m.memberToken)} label="Link" />
                      {m.status !== 'signed' && m.email && (
                        <button onClick={() => handleSendInvite(m.id)} disabled={busy} className="text-xs px-2 py-1 rounded-lg border border-brand/30 text-brand hover:bg-brand/5 shrink-0">
                          {m.invitedAt ? 'Resend' : 'Invite'}
                        </button>
                      )}
                      <button onClick={() => handleRemoveMember(m.id)} disabled={busy} className="text-xs text-gray-400 hover:text-red-500 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
                {selected.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input className="form-input flex-1 min-w-[120px] text-sm" value={mName} onChange={e => setMName(e.target.value)} placeholder="Name" />
                    <input className="form-input flex-1 min-w-[160px] text-sm" value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="email@address.com" />
                    <button onClick={() => handleAddMember(false)} disabled={busy} className="btn-secondary text-sm">Add</button>
                    <button onClick={() => handleAddMember(true)} disabled={busy} className="btn-primary text-sm">Add + invite</button>
                  </div>
                )}
              </div>

              {selected.status !== 'cancelled' && (
                <div className="border-t border-black/5 pt-3">
                  <button onClick={handleCancel} disabled={busy} className="text-sm text-gray-400 hover:text-red-500 underline">Cancel reservation</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
