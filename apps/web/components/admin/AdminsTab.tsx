'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchAdmins, addAdmin, removeAdmin, type GlobalAdmin } from '@/lib/admin'

export default function AdminsTab() {
  const [admins, setAdmins] = useState<GlobalAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setAdmins(await fetchAdmins())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function submit() {
    if (!email.trim()) return
    setSubmitting(true)
    setActionError(null)
    setActionNote(null)
    try {
      const result = await addAdmin(email.trim())
      setEmail('')
      setActionNote(
        result.via === 'existing_operator_account'
          ? 'Added — this email already had operator access, and now also has admin access.'
          : result.via === 'new_invite'
          ? 'Added — an invite email was sent so they can set their own password.'
          : 'Added — an existing account was found and linked.'
      )
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to add admin')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmedRemove(id: string) {
    setBusyId(id)
    setActionError(null)
    try {
      await removeAdmin(id)
      setConfirmRemoveId(null)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove admin')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading admins…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Admin access</h1>
        <p className="text-sm text-gray-400">
          {admins.length} {admins.length === 1 ? 'person has' : 'people have'} global admin access. An email already
          linked to an operator account can also be granted admin access — the two are independent.
        </p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>×</button>
        </div>
      )}
      {actionNote && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-700 flex justify-between">
          <span>{actionNote}</span>
          <button onClick={() => setActionNote(null)}>×</button>
        </div>
      )}

      <div className="card mb-4">
        <h2 className="font-semibold text-sm text-ink mb-3">Grant admin access</h2>
        <div className="flex gap-2">
          <input
            className="form-input flex-1"
            placeholder="teammate@liabl.app"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          <button onClick={submit} disabled={submitting || !email.trim()} className="btn-primary px-4">
            {submitting ? 'Adding…' : 'Grant access'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          If this email already has an account (as an operator member or otherwise), it's linked directly. If it's
          brand new, an invite email is sent so they can set their own password — no password ever passes through
          this console.
        </p>
      </div>

      <div className="space-y-2">
        {admins.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-black/8 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">{a.email}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Admin since {new Date(a.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                {a.alsoOperatorMember && (
                  <> · also {a.alsoOperatorMember.role} at {a.alsoOperatorMember.operatorName}</>
                )}
              </div>
            </div>
            {confirmRemoveId === a.id ? (
              <span className="flex items-center gap-2 text-xs shrink-0">
                <button onClick={() => confirmedRemove(a.id)} disabled={busyId === a.id} className="text-red-700 font-medium underline">
                  {busyId === a.id ? 'Removing…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmRemoveId(null)} className="text-gray-400 underline">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmRemoveId(a.id)} className="text-xs text-red-500 hover:text-red-700 underline shrink-0">
                Remove access
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
