'use client'
// Account security — the self-service half of login management: change
// your password and manage your two-factor methods. Organization-level
// settings live in SettingsTab around this; this card is strictly about
// the signed-in user's own credentials.
//
// Because MFA is required for every operator user, this panel refuses to
// remove your last remaining factor — add a replacement first. Adding and
// removing factors both require an aal2 session, which every user inside
// the console already has (the login gate guarantees it).
import { useState, useEffect, useCallback } from 'react'
import { updatePassword } from '@/lib/auth'
import { listFactors, unenrollFactor, type MfaFactor } from '@/lib/mfa'
import MfaEnroll from '@/components/operator/MfaEnroll'

export default function SecurityPanel() {
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Change-password sub-form
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setFactors(await listFactors())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load security settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function changePassword() {
    setPwError(null); setPwDone(false)
    if (pw.length < 8) { setPwError('Use at least 8 characters.'); return }
    if (pw !== pw2) { setPwError('The two passwords don’t match.'); return }
    setSavingPw(true)
    try {
      await updatePassword(pw)
      setPw(''); setPw2(''); setPwDone(true)
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Could not update password')
    } finally {
      setSavingPw(false)
    }
  }

  async function remove(id: string) {
    if (factors.length <= 1) {
      setError('Add another method before removing this one — two-factor authentication is required.')
      return
    }
    setRemovingId(id); setError(null); setNotice(null)
    try {
      await unenrollFactor(id)
      setNotice('Verification method removed.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that method')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="card mb-4">
      <h2 className="font-semibold text-sm text-ink mb-1">Security &amp; sign-in</h2>
      <p className="text-xs text-gray-400 mb-4">Your password and two-factor verification methods.</p>

      {/* Change password */}
      <div className="border border-black/8 rounded-xl p-3.5 mb-4">
        <div className="text-sm font-medium text-ink mb-3">Change password</div>
        {pwError && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">{pwError}</div>}
        {pwDone && <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3 text-xs text-green-700">Password updated.</div>}
        <div className="grid sm:grid-cols-2 gap-2.5 mb-3">
          <input type="password" autoComplete="new-password" className="form-input" placeholder="New password"
            value={pw} onChange={e => setPw(e.target.value)} />
          <input type="password" autoComplete="new-password" className="form-input" placeholder="Confirm new password"
            value={pw2} onChange={e => setPw2(e.target.value)} />
        </div>
        <button onClick={changePassword} disabled={savingPw || !pw || !pw2} className="btn-secondary py-2 text-sm">
          {savingPw ? 'Saving…' : 'Update password'}
        </button>
      </div>

      {/* Two-factor methods */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-ink">Two-factor authentication</div>
        <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-green-50 text-green-600">Required</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3 text-xs text-green-700">{notice}</div>}

      {loading ? (
        <div className="text-sm text-gray-400 py-2">Loading…</div>
      ) : (
        <div className="space-y-2">
          {factors.map(f => (
            <div key={f.id} className="flex items-center justify-between bg-surface rounded-xl border border-black/8 p-3">
              <div>
                <div className="text-sm text-ink">
                  {f.type === 'phone' ? 'Text message (SMS)' : (f.friendlyName || 'Authenticator app')}
                  {f.type === 'phone' && f.phone ? <span className="text-gray-400"> · ••• {f.phone}</span> : null}
                </div>
                <div className="text-xs text-gray-400">{f.type === 'phone' ? 'Codes sent by text' : 'Codes from your authenticator app'}</div>
              </div>
              <button onClick={() => remove(f.id)} disabled={removingId === f.id}
                className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-40">
                {removingId === f.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
          {factors.length === 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              You have no verification method set up. Add one now — it’s required.
            </div>
          )}
        </div>
      )}

      {adding ? (
        <div className="mt-3">
          <MfaEnroll allowCancel onCancel={() => setAdding(false)} onEnrolled={() => { setAdding(false); setNotice('Verification method added.'); refresh() }} />
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setError(null); setNotice(null) }} className="text-sm text-brand font-medium mt-3">
          + Add a method
        </button>
      )}
    </div>
  )
}
