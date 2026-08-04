'use client'
// Step-up challenge for a user who already has a verified second factor.
// Shown on the login page after the password check when the session is
// still aal1. Reusable and self-contained: give it the user's factors and
// a success callback. It sends exactly one challenge per selected factor
// (so a phone factor texts one code, not one per keystroke) and verifies
// against that challenge.
import { useState, useEffect, useCallback } from 'react'
import { sendChallenge, verifyCode, type MfaFactor } from '@/lib/mfa'
import { rememberThisDevice } from '@/lib/trusted-device'

export default function MfaChallenge({ factors, onVerified, showRemember = false }: {
  factors: MfaFactor[]
  onVerified: () => void
  /** Show the "remember this device for 30 days" opt-in (login only). */
  showRemember?: boolean
}) {
  const [remember, setRemember] = useState(false)
  const [factorId, setFactorId] = useState(factors[0]?.id ?? '')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const active = factors.find(f => f.id === factorId) ?? factors[0]
  const isPhone = active?.type === 'phone'

  // Open a fresh challenge whenever the selected factor changes. For a
  // phone factor this is what actually sends the SMS; for TOTP it just
  // opens the verification window. One challenge per selection.
  const openChallenge = useCallback(async (id: string) => {
    setError(null); setChallengeId(null); setSending(true)
    try {
      setChallengeId(await sendChallenge(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the verification')
    } finally {
      setSending(false)
    }
  }, [])

  useEffect(() => { if (factorId) openChallenge(factorId) }, [factorId, openChallenge])

  async function submit() {
    if (!challengeId || code.trim().length < 6) return
    setVerifying(true); setError(null)
    try {
      await verifyCode(factorId, challengeId, code)
      // Register the trust AFTER the step-up succeeds, so the cookie is
      // only ever issued to a session that just passed a second factor.
      if (showRemember && remember) await rememberThisDevice().catch(() => {})
      onVerified()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t match. Try again.')
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="card">
      <h1 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Two-factor verification</h1>
      <p className="text-sm text-gray-400 mb-5">
        {isPhone
          ? 'Enter the 6-digit code we just texted you.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      {factors.length > 1 && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Verify with</label>
          <select className="form-input" value={factorId} onChange={e => setFactorId(e.target.value)}>
            {factors.map(f => (
              <option key={f.id} value={f.id}>
                {f.type === 'phone' ? `Text message${f.phone ? ` (••• ${f.phone})` : ''}` : (f.friendlyName || 'Authenticator app')}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

      <form onSubmit={e => { e.preventDefault(); submit() }}>
        <label htmlFor="mfa-code" className="block text-xs text-gray-500 mb-1">Verification code</label>
        <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
          className="form-input tracking-[0.4em] text-center text-lg"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000" />

        {showRemember && (
          <label className="flex items-center gap-2 mt-4 text-sm text-gray-600 select-none cursor-pointer">
            <input type="checkbox" className="rounded border-black/20" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Remember this device for 30 days
          </label>
        )}

        <button type="submit" disabled={verifying || sending || code.trim().length < 6}
          className="btn-primary w-full py-2.5 mt-4">
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      {isPhone && (
        <button onClick={() => openChallenge(factorId)} disabled={sending}
          className="text-xs text-brand underline mt-3 disabled:opacity-40">
          {sending ? 'Sending…' : 'Resend code'}
        </button>
      )}
    </div>
  )
}
