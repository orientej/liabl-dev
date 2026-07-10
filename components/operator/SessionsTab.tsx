'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchEngineData } from '@/lib/document-engine'
import { getCurrentOperatorMember, updateOperatorProfile, type CurrentOperatorMember } from '@/lib/auth'
import { listTeamMembers, listInvites, createInvite, revokeInvite, type TeamMember, type Invite } from '@/lib/invites'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland',
  'Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

export default function SettingsTab() {
  const [member,   setMember]   = useState<CurrentOperatorMember | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [lawState, setLawState] = useState('')
  const [lawCounty, setLawCounty] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const m = await getCurrentOperatorMember()
      if (!m) throw new Error('No organization found for your account')
      setMember(m)

      const { createClient } = await import('@/lib/supabase')
      const engineData = await fetchEngineData(createClient())
      setName(engineData.operatorName)
      setLawState(engineData.governingLawState)
      setLawCounty(engineData.governingLawCounty ?? '')

      const [teamData, inviteData] = await Promise.all([
        listTeamMembers(m.operatorId),
        listInvites(m.operatorId),
      ])
      setTeam(teamData)
      setInvites(inviteData)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function saveProfile() {
    if (!member || !name.trim() || !lawState.trim()) return
    setSavingProfile(true)
    setActionError(null)
    try {
      await updateOperatorProfile(member.operatorId, {
        name, governingLawState: lawState, governingLawCounty: lawCounty || null,
      })
      setEditingProfile(false)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save organization profile')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading settings…</div>

  if (loadError || !member) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <div className="font-semibold mb-0.5">Couldn&apos;t load settings</div>
        <div className="text-xs">{loadError}</div>
        <button onClick={refresh} className="text-xs underline mt-1">Try again</button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Settings</h1>
        <p className="text-sm text-gray-400">Organization profile and team access.</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-red-400 hover:text-red-700">×</button>
        </div>
      )}

      {/* Organization profile */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm text-ink">Organization profile</h2>
          {!editingProfile && <button onClick={() => setEditingProfile(true)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface">Edit</button>}
        </div>

        {!editingProfile ? (
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-400">Name:</span> {name}</div>
            <div><span className="text-gray-400">Governing law:</span> {lawState}{lawCounty ? `, ${lawCounty}` : ''}</div>
          </div>
        ) : (
          <div>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Organization name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Governing law — state</label>
                <select className="form-input" value={lawState} onChange={e => setLawState(e.target.value)}>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">County (optional)</label>
                <input className="form-input" value={lawCounty} onChange={e => setLawCounty(e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-4">This determines the governing-law clause on every waiver you generate.</div>
            <div className="flex gap-2">
              <button onClick={() => setEditingProfile(false)} className="btn-secondary py-2 text-sm">Cancel</button>
              <button onClick={saveProfile} disabled={savingProfile || !name.trim() || !lawState.trim()} className="btn-primary py-2 text-sm">
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Participant sign-in page */}
      <ParticipantUrlCard />

      {/* Team */}
      <div className="card mb-4">
        <h2 className="font-semibold text-sm text-ink mb-4">Team ({team.length})</h2>
        <div className="space-y-2">
          {team.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-surface rounded-xl border border-black/8 p-3">
              <div>
                <div className="text-sm text-ink">{t.email ?? 'Unknown'}</div>
                <div className="text-xs text-gray-400">Joined {new Date(t.joinedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.role === 'owner' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>
                {t.role === 'owner' ? 'Owner' : 'Staff'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Invites */}
      <InvitePanel
        operatorId={member.operatorId}
        invitedByUserId={member.userId}
        invites={invites}
        onChanged={refresh}
        onError={setActionError}
      />
    </div>
  )
}

function InvitePanel({ operatorId, invitedByUserId, invites, onChanged, onError }: {
  operatorId: string; invitedByUserId: string; invites: Invite[]
  onChanged: () => Promise<void>; onError: (e: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'staff'>('staff')
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  async function submit() {
    if (!email.trim()) return
    setSubmitting(true)
    try {
      const { id } = await createInvite({ operatorId, email, role, invitedByUserId })
      // Sending the email is a separate step (same pattern as waiver
      // signing separates the DB write from logging/sealing) — the
      // invite row exists regardless of whether this send succeeds, so
      // a delivery hiccup doesn't lose the invite itself.
      const res = await fetch('/api/invites/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Invite created, but the email failed to send')
      }
      setEmail('')
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  async function revoke(id: string) {
    setRevokingId(id)
    try {
      await revokeInvite(id)
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to revoke invite')
    } finally {
      setRevokingId(null)
    }
  }

  const pending = invites.filter(i => i.status === 'pending')

  return (
    <div className="card">
      <h2 className="font-semibold text-sm text-ink mb-4">Invite a teammate</h2>
      <div className="flex gap-2 mb-4">
        <input className="form-input flex-1" placeholder="teammate@example.com" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <select className="form-input w-32" value={role} onChange={e => setRole(e.target.value as 'owner' | 'staff')}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <button onClick={submit} disabled={submitting || !email.trim()} className="btn-primary px-4">
          {submitting ? 'Sending…' : 'Invite'}
        </button>
      </div>

      {pending.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pending invites</div>
          <div className="space-y-2">
            {pending.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-surface rounded-xl border border-black/8 p-3">
                <div>
                  <div className="text-sm text-ink">{inv.email}</div>
                  <div className="text-xs text-gray-400">
                    {inv.role === 'owner' ? 'Owner' : 'Staff'} · expires {new Date(inv.expiresAt).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                  </div>
                </div>
                <button onClick={() => revoke(inv.id)} disabled={revokingId === inv.id} className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-40">
                  {revokingId === inv.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantUrlCard() {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/participant` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(baseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Non-fatal — the input below is still selectable/copyable by hand.
    }
  }

  return (
    <div className="card mb-4">
      <h2 className="font-semibold text-sm text-ink mb-1">Participant sign-in page</h2>
      <p className="text-xs text-gray-400 mb-3">
        This is the base address participants land on to sign a waiver. It needs a specific check-in link to know
        which activity and timeslot they&apos;re signing for — head to the Sessions tab to create one and get its
        shareable link or QR code.
      </p>
      <div className="flex gap-2">
        <input readOnly value={baseUrl} className="form-input text-xs font-mono flex-1" onClick={e => (e.target as HTMLInputElement).select()} />
        <button onClick={copy} className="text-xs px-3 py-2 rounded-lg border border-black/10 hover:bg-surface shrink-0 whitespace-nowrap">
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
