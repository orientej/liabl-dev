'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchUsers, updateUserRole, removeUser, type AdminUser } from '@/lib/admin'
import { getCurrentAdmin } from '@/lib/admin-auth'

export default function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setUsers(await fetchUsers())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    ;(async () => {
      const admin = await getCurrentAdmin()
      if (admin) { setAdminId(admin.userId); setAdminEmail(admin.email) }
    })()
  }, [refresh])

  async function changeRole(u: AdminUser, role: 'owner' | 'staff') {
    setBusyId(u.id)
    setActionError(null)
    try {
      await updateUserRole(u.id, role)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmedRemove(u: AdminUser) {
    setBusyId(u.id)
    setActionError(null)
    try {
      await removeUser(u.id)
      setConfirmRemoveId(null)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove user')
    } finally {
      setBusyId(null)
    }
  }

  // Requests the one-time token server-side (properly authorized and
  // audit-logged there), then opens the verification page in a NEW TAB —
  // never touches this tab's own admin session. See lib/supabase.ts and
  // app/operator/impersonate/page.tsx for why a new tab with its own
  // sessionStorage is what keeps the two identities from colliding.
  async function impersonate(u: AdminUser) {
    setBusyId(u.id)
    setActionError(null)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: u.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to start impersonation')

      const params = new URLSearchParams({
        token: body.tokenHash,
        email: body.targetEmail,
        operator: body.operatorName,
        targetUserId: u.userId,
        targetOperatorId: u.operatorId ?? '',
        adminId: adminId ?? '',
        adminEmail: adminEmail ?? '',
      })
      window.open(`/operator/impersonate?${params.toString()}`, '_blank')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to start impersonation')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter(u =>
    !search.trim() ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.operatorName.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading users…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Users</h1>
        <p className="text-sm text-gray-400">{users.length} team member{users.length === 1 ? '' : 's'} across every operator.</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      <input className="form-input mb-4" placeholder="Search by email or organization…" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-black/8 p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink text-sm">{u.email ?? 'Unknown'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'owner' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>
                  {u.role === 'owner' ? 'Owner' : 'Staff'}
                </span>
                {u.operatorStatus === 'suspended' && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700">Org suspended</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {u.operatorName} · joined {new Date(u.joinedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => impersonate(u)}
                disabled={busyId === u.id || u.operatorStatus === 'suspended'}
                title={u.operatorStatus === 'suspended' ? "Can't impersonate a member of a suspended account" : 'Opens a new tab, logged in as this user'}
                className="text-xs px-3 py-1.5 rounded-lg border border-brand/30 text-brand bg-brand/5 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busyId === u.id ? 'Starting…' : 'Impersonate'}
              </button>
              <select
                value={u.role}
                disabled={busyId === u.id}
                onChange={e => changeRole(u, e.target.value as 'owner' | 'staff')}
                className="text-xs border border-black/10 rounded-lg px-2 py-1.5"
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
              {confirmRemoveId === u.id ? (
                <span className="flex items-center gap-1 text-xs">
                  <button onClick={() => confirmedRemove(u)} disabled={busyId === u.id} className="text-red-700 font-medium underline">Confirm</button>
                  <button onClick={() => setConfirmRemoveId(null)} className="text-gray-400 underline">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmRemoveId(u.id)} className="text-xs text-red-500 hover:text-red-700 underline">Remove</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">No users match that search.</div>
        )}
      </div>
    </div>
  )
}
