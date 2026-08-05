'use client'
// Group reservations — operator console.
//
// Layout is a two-panel workflow (Aug 2026 redline): a persistent "New
// reservation" form on the left, and a browse/detail panel on the right.
// Choosing an activity/date on the left filters the right-hand list, so the
// two panels read as one flow rather than two disconnected screens.
//
// Each reservation surfaces three distinct counts — Expected / Signed /
// Checked in — plus who still hasn't signed and a scoped reminder, an
// editable expected size, and a "Check in this group" hand-off into the
// Roster once everyone has signed.
import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { getCurrentOperatorMember } from '@/lib/auth'
import { createSession } from '@/lib/sessions'
import {
  listReservations, createReservation, listReservationMembers, addReservationMember,
  removeReservationMember, setReservationStatus, updateReservationPartySize,
  type ReservationRecord, type ReservationMemberRecord,
} from '@/lib/reservations'
import {
  reservationSelfServiceUrl, reservationCheckInUrl, reservationMemberCheckInUrl, reservationGroupCheckInUrl,
} from '@/lib/participant-url'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Escapes text interpolated into the print-poster HTML string.
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

// A single compact count for the stat row.
function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'brand' | 'emerald' | 'ink' }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'emerald' ? 'text-emerald-600' : 'text-ink'
  return (
    <div>
      <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">{label}</div>
    </div>
  )
}

export default function ReservationsTab({ onCheckInGroup }: { onCheckInGroup?: (sessionId: string) => void } = {}) {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [operatorUserId, setOperatorUserId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [reservations, setReservations] = useState<ReservationRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<ReservationMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Create form (persistent, left panel)
  const [fActivity, setFActivity] = useState('')
  const [fDate, setFDate] = useState(todayISO())
  const [fParty, setFParty] = useState('')
  const [fOrgName, setFOrgName] = useState('')
  const [fOrgEmail, setFOrgEmail] = useState('')

  // Browse filters (right panel) — default the list to the create date.
  const [filterActivity, setFilterActivity] = useState('')
  const [filterDate, setFilterDate] = useState(todayISO())
  const [filterOrg, setFilterOrg] = useState('')

  // Expected-size inline edit
  const [editingExpected, setEditingExpected] = useState(false)
  const [expectedDraft, setExpectedDraft] = useState('')

  // Add-member form
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')

  // Shared check-in QR (for on-site walk-ups)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const selected = reservations.find(r => r.id === selectedId) ?? null

  // Walk-ups = signed check-ins not tied to a named attendee.
  const membersSigned = members.filter(m => m.status === 'signed').length
  const walkUps = selected ? Math.max(0, selected.signedCount - membersSigned) : 0
  const unsignedMembers = members.filter(m => m.status !== 'signed')
  const remindableCount = unsignedMembers.filter(m => m.email).length

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

  // Generate the shared check-in QR whenever the selection changes.
  useEffect(() => {
    setQrDataUrl(null)
    if (!selectedId) return
    const url = reservationCheckInUrl(selectedId)
    if (url) QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [selectedId])

  // Changing the create form's activity/date also drives the browse filter
  // (Issue 4) — selecting what you're about to book shows any groups that
  // already exist for it.
  function pickActivity(v: string) { setFActivity(v); setFilterActivity(v) }
  function pickDate(v: string) { setFDate(v); setFilterDate(v) }

  const filtered = reservations.filter(r => {
    if (filterActivity && r.activityKey !== filterActivity) return false
    if (filterDate && r.reservationDate !== filterDate) return false
    if (filterOrg.trim()) {
      const q = filterOrg.toLowerCase()
      const hay = `${r.organizerName ?? ''} ${r.organizerEmail ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const filtersActive = !!(filterActivity || filterDate || filterOrg.trim())

  // Opens a print-friendly poster (QR + label) in a new window.
  function printPoster() {
    if (!selected || !qrDataUrl) return
    const activityLabel = activities.find(a => a.key === selected.activityKey)?.displayName ?? selected.activityKey
    const title = selected.organizerName ? `${selected.organizerName} — ${activityLabel}` : activityLabel
    const w = window.open('', '_blank', 'width=520,height=680')
    if (!w) return
    w.document.write(
      `<html><head><title>Check-in QR</title></head>` +
      `<body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px;color:#1a1a1a;">` +
      `<h1 style="font-size:22px;margin-bottom:4px;">${escapeText(title)}</h1>` +
      `<p style="color:#666;font-size:14px;margin-top:0;">Scan to check in${selected.reservationDate ? ` · ${escapeText(selected.reservationDate)}` : ''}</p>` +
      `<img src="${qrDataUrl}" alt="Check-in QR" style="width:320px;height:320px;margin:24px auto;"/>` +
      `<p style="color:#888;font-size:12px;">Powered by LIABL</p>` +
      `</body></html>`
    )
    w.document.close()
    w.focus()
    w.print()
  }

  async function handleCreate() {
    if (!operatorId || !fActivity) return
    setBusy(true); setError(null); setNotice(null)
    try {
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
      setFParty(''); setFOrgName(''); setFOrgEmail('')
      // Make sure the new reservation is visible in the filtered list.
      setFilterActivity(fActivity); setFilterDate(fDate); setFilterOrg('')
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

  // Issue 1 — one reminder to everyone in this group who still hasn't signed.
  async function handleRemindUnsigned() {
    if (!selected) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/reservations/${selected.id}/send-invites`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remindUnsigned: true }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to send reminders')
      setNotice(body.sent > 0
        ? `Reminder sent to ${body.sent} attendee${body.sent === 1 ? '' : 's'} who haven’t signed yet.`
        : 'No one to remind — everyone with an email has already signed.')
      await loadMembers(selected.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reminders')
    } finally { setBusy(false) }
  }

  // Issue 5 — mark the whole party present, then jump into the Roster.
  async function handleCheckInGroup() {
    if (!selected) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/reservations/${selected.id}/check-in`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to check in the group')
      await refresh()
      if (selected.sessionId && onCheckInGroup) onCheckInGroup(selected.sessionId)
      else setNotice(`Checked in ${body.checkedIn} attendee${body.checkedIn === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check in the group')
    } finally { setBusy(false) }
  }

  async function saveExpected() {
    if (!selected) return
    setBusy(true); setError(null)
    try {
      await updateReservationPartySize(selected.id, expectedDraft ? Number(expectedDraft) : null)
      setEditingExpected(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update expected size')
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
      {/* Title area (Issue 4 — no confusing "Close" primary on entry) */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Group reservations</h2>
        <p className="text-sm text-gray-500">
          Book a party, invite attendees to complete their waivers before the event, track who&apos;s signed, and check the group in.
        </p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex justify-between gap-2"><span>{error}</span><button onClick={() => setError(null)} className="shrink-0">×</button></div>}
      {notice && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex justify-between gap-2"><span>{notice}</span><button onClick={() => setNotice(null)} className="shrink-0">×</button></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT — persistent create panel */}
        <div className="md:col-span-1">
          <div className="card space-y-3">
            <div className="text-sm font-semibold text-ink">New reservation</div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Activity</label>
              <select className="form-input" value={fActivity} onChange={e => pickActivity(e.target.value)}>
                {activities.map(a => <option key={a.id} value={a.key}>{a.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" className="form-input" value={fDate} onChange={e => pickDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected party size</label>
              <input type="number" min="1" className="form-input" value={fParty} onChange={e => setFParty(e.target.value)} placeholder="e.g. 8" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Organizer name</label>
              <input className="form-input" value={fOrgName} onChange={e => setFOrgName(e.target.value)} placeholder="Party organizer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Organizer email</label>
              <input type="email" className="form-input" value={fOrgEmail} onChange={e => setFOrgEmail(e.target.value)} placeholder="organizer@email.com" />
            </div>
            <button onClick={handleCreate} disabled={busy || !fActivity} className="btn-primary text-sm w-full">Create reservation</button>
          </div>
        </div>

        {/* RIGHT — browse list, or the selected reservation's detail */}
        <div className="md:col-span-2">
          {!selected ? (
            <div>
              {/* Filter / search bar (Issue 3) */}
              <div className="card mb-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Activity</label>
                    <select className="form-input text-sm" value={filterActivity} onChange={e => setFilterActivity(e.target.value)}>
                      <option value="">All activities</option>
                      {activities.map(a => <option key={a.id} value={a.key}>{a.displayName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Date</label>
                    <input type="date" className="form-input text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Organizer</label>
                    <input className="form-input text-sm" value={filterOrg} onChange={e => setFilterOrg(e.target.value)} placeholder="Search name/email" />
                  </div>
                </div>
                {filtersActive && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{filtered.length} of {reservations.length} reservation{reservations.length === 1 ? '' : 's'}</span>
                    <button onClick={() => { setFilterActivity(''); setFilterDate(''); setFilterOrg('') }} className="text-brand hover:underline">Clear filters</button>
                  </div>
                )}
              </div>

              {/* Reservation list */}
              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 px-1">
                    {reservations.length === 0 ? 'No reservations yet — create one on the left.' : 'No reservations match these filters.'}
                  </p>
                )}
                {filtered.map(r => {
                  const activity = activities.find(a => a.key === r.activityKey)
                  const outstanding = Math.max(0, r.expectedCount - r.signedCount)
                  return (
                    <button key={r.id} onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-all border-black/10 hover:border-black/20 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <div className="text-sm font-medium text-ink flex items-center gap-2">
                        {r.organizerName || 'Group reservation'}
                        {r.status === 'cancelled' && <span className="text-[10px] uppercase text-gray-400 border border-black/10 rounded px-1">Cancelled</span>}
                        {r.status === 'complete' && <span className="text-[10px] uppercase text-emerald-600 border border-emerald-200 rounded px-1">Complete</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {activity?.displayName ?? r.activityKey}{r.reservationDate ? ` · ${r.reservationDate}` : ''}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="text-gray-500">Expected <span className="font-semibold text-ink">{r.expectedCount || '—'}</span></span>
                        <span className="text-gray-500">Signed <span className="font-semibold text-brand">{r.signedCount}</span></span>
                        <span className="text-gray-500">Checked in <span className="font-semibold text-emerald-600">{r.checkedInCount}</span></span>
                      </div>
                      {r.status !== 'cancelled' && outstanding > 0 && (
                        <div className="mt-1.5 text-xs text-amber-600 font-medium">View outstanding ({outstanding}) →</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <button onClick={() => setSelectedId(null)} className="text-xs text-brand hover:underline">← All reservations</button>

              {/* Header + three counts (Issue 2) */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium text-ink">{selected.organizerName || 'Group reservation'}</div>
                  <div className="text-xs text-gray-500">
                    {activities.find(a => a.key === selected.activityKey)?.displayName ?? selected.activityKey}
                    {selected.reservationDate ? ` · ${selected.reservationDate}` : ''}
                    {selected.status === 'cancelled' && <span className="ml-2 text-[10px] uppercase text-gray-400 border border-black/10 rounded px-1">Cancelled</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 border-y border-black/5 py-3">
                {/* Expected — editable */}
                <div>
                  {editingExpected ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min="1" autoFocus className="form-input w-20 py-1 text-sm"
                        value={expectedDraft} onChange={e => setExpectedDraft(e.target.value)} placeholder={String(selected.memberCount || '')} />
                      <button onClick={saveExpected} disabled={busy} className="text-xs text-brand font-medium">Save</button>
                      <button onClick={() => setEditingExpected(false)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingExpected(true); setExpectedDraft(selected.partySize ? String(selected.partySize) : '') }}
                      className="text-left group" title="Edit expected size">
                      <div className="text-xl font-bold leading-none text-ink group-hover:text-brand">{selected.expectedCount || '—'}</div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">Expected ✎</div>
                    </button>
                  )}
                </div>
                <Stat label="Signed" value={selected.signedCount} tone="brand" />
                <Stat label="Checked in" value={selected.checkedInCount} tone="emerald" />
                {walkUps > 0 && (
                  <div className="text-[11px] text-gray-400 self-center">{membersSigned} invited · {walkUps} walk-up{walkUps === 1 ? '' : 's'}</div>
                )}
              </div>

              {/* Primary actions: reminder + check-in (Issues 1 & 5) */}
              {selected.status !== 'cancelled' && (
                <div className="flex flex-wrap items-center gap-2">
                  {remindableCount > 0 && (
                    <button onClick={handleRemindUnsigned} disabled={busy}
                      className="btn-secondary text-sm">Send reminder ({remindableCount})</button>
                  )}
                  {selected.sessionId && selected.expectedCount > 0 && selected.signedCount >= selected.expectedCount ? (
                    <button onClick={handleCheckInGroup} disabled={busy} className="btn-primary text-sm">
                      {selected.checkedInCount >= selected.signedCount ? 'Open roster →' : 'Check in this group →'}
                    </button>
                  ) : selected.sessionId ? (
                    <button onClick={() => onCheckInGroup && selected.sessionId && onCheckInGroup(selected.sessionId)} className="text-sm text-brand hover:underline">Open in roster →</button>
                  ) : null}
                  {selected.expectedCount > 0 && selected.signedCount < selected.expectedCount && (
                    <span className="text-xs text-gray-400">{Math.max(0, selected.expectedCount - selected.signedCount)} still to sign before group check-in</span>
                  )}
                </div>
              )}

              {/* Outstanding named attendees (Issue 1) */}
              {selected.status !== 'cancelled' && unsignedMembers.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <div className="text-xs font-semibold text-amber-800 mb-1.5">Outstanding — {unsignedMembers.length} attendee{unsignedMembers.length === 1 ? '' : 's'} haven’t signed</div>
                  <div className="space-y-1">
                    {unsignedMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink truncate">{m.fullName || m.email || 'Attendee'}<span className="text-gray-400">{m.fullName && m.email ? ` · ${m.email}` : ''}</span></span>
                        <span className="text-gray-400 shrink-0">{m.email ? (m.invitedAt ? 'invited' : 'not invited') : 'no email'}</span>
                      </div>
                    ))}
                  </div>
                  {selected.expectedCount > selected.memberCount && (
                    <div className="text-[11px] text-amber-700 mt-1.5">Plus {selected.expectedCount - selected.memberCount} more expected not yet added as named attendees.</div>
                  )}
                </div>
              )}

              {/* Shareable links */}
              <div className="space-y-2 border-t border-black/5 pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-gray-500">Organizer self-service link (hand this to the party organizer)</div>
                  <CopyButton text={reservationSelfServiceUrl(selected.selfServiceToken)} label="Copy" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-gray-500">Shared check-in link (walk-ups)</div>
                  <CopyButton text={reservationCheckInUrl(selected.id)} label="Copy" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-gray-500">Group-leader link (one person signs for everyone on one device)</div>
                  <CopyButton text={reservationGroupCheckInUrl(selected.id)} label="Copy" />
                </div>

                {selected.status !== 'cancelled' && qrDataUrl && (
                  <div className="flex items-center gap-4 pt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Shared check-in QR" className="w-28 h-28 rounded-lg border border-black/10" />
                    <div className="text-xs text-gray-500">
                      <div className="mb-2">Show or print this at check-in — anyone who scans it signs against this reservation as a walk-up.</div>
                      <button onClick={printPoster} className="text-xs px-2.5 py-1 rounded-lg border border-black/10 text-gray-600 hover:border-black/20 hover:text-ink">Print QR poster</button>
                    </div>
                  </div>
                )}
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
