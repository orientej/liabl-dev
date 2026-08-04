'use client'
// Enroll a new second factor — an authenticator app (TOTP) or a phone
// (SMS). Used in two places: the mandatory setup gate on the login page
// (MFA is required for every operator user) and the voluntary "add a
// method" control in account settings. The `allowCancel` prop is what
// distinguishes those two callers — the login gate cannot be dismissed.
import { useState } from 'react'
import { enrollTotp, enrollPhone, sendChallenge, challengeAndVerify, verifyCode } from '@/lib/mfa'
import { rememberThisDevice } from '@/lib/trusted-device'

type Method = 'choose' | 'totp' | 'phone'

export default function MfaEnroll({ onEnrolled, allowCancel = false, onCancel, showRemember = false }: {
  onEnrolled: () => void
  allowCancel?: boolean
  onCancel?: () => void
  /** Show the "remember this device for 30 days" opt-in (login only). */
  showRemember?: boolean
}) {
  const [method, setMethod] = useState<Method>('choose')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(false)

  // TOTP state
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [totpFactorId, setTotpFactorId] = useState('')

  // Phone state
  const [phone, setPhone] = useState('')
  const [phoneFactorId, setPhoneFactorId] = useState('')
  const [phoneChallengeId, setPhoneChallengeId] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const [code, setCode] = useState('')

  async function startTotp() {
    setBusy(true); setError(null)
    try {
      const { factorId, qrCode, secret } = await enrollTotp()
      setTotpFactorId(factorId); setQrCode(qrCode); setSecret(secret); setMethod('totp')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start authenticator setup')
    } finally { setBusy(false) }
  }

  async function verifyTotp() {
    if (code.trim().length < 6) return
    setBusy(true); setError(null)
    try {
      await challengeAndVerify(totpFactorId, code)
      if (showRemember && remember) await rememberThisDevice().catch(() => {})
      onEnrolled()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t match. Try again.')
      setCode('')
    } finally { setBusy(false) }
  }

  async function sendPhoneCode() {
    if (!/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
      setError('Enter your number in international format, e.g. +14155551234')
      return
    }
    setBusy(true); setError(null)
    try {
      const factorId = phoneFactorId || (await enrollPhone(phone.trim()))
      setPhoneFactorId(factorId)
      setPhoneChallengeId(await sendChallenge(factorId))
      setCodeSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the text message')
    } finally { setBusy(false) }
  }

  async function verifyPhone() {
    if (code.trim().length < 6 || !phoneChallengeId) return
    setBusy(true); setError(null)
    try {
      await verifyCode(phoneFactorId, phoneChallengeId, code)
      if (showRemember && remember) await rememberThisDevice().catch(() => {})
      onEnrolled()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t match. Try again.')
      setCode('')
    } finally { setBusy(false) }
  }

  const CodeInput = (
    <>
      <label htmlFor="enroll-code" className="block text-xs text-gray-500 mb-1">Verification code</label>
      <input id="enroll-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
        className="form-input tracking-[0.4em] text-center text-lg"
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
    </>
  )

  const RememberBox = showRemember ? (
    <label className="flex items-center gap-2 mt-4 text-sm text-gray-600 select-none cursor-pointer">
      <input type="checkbox" className="rounded border-black/20" checked={remember} onChange={e => setRemember(e.target.checked)} />
      Remember this device for 30 days
    </label>
  ) : null

  return (
    <div className="card">
      <h1 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>
        {allowCancel ? 'Add a verification method' : 'Set up two-factor authentication'}
      </h1>
      <p className="text-sm text-gray-400 mb-5">
        {allowCancel
          ? 'Add a second factor to your account.'
          : 'Two-factor authentication is required. Add a method to finish signing in.'}
      </p>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

      {method === 'choose' && (
        <div className="space-y-2.5">
          <button onClick={startTotp} disabled={busy}
            className="w-full text-left border border-black/10 rounded-xl p-3.5 hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-50">
            <div className="text-sm font-medium text-ink">Authenticator app</div>
            <div className="text-xs text-gray-400">Google Authenticator, Authy, 1Password — recommended, works offline.</div>
          </button>
          <button onClick={() => { setMethod('phone'); setError(null) }} disabled={busy}
            className="w-full text-left border border-black/10 rounded-xl p-3.5 hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-50">
            <div className="text-sm font-medium text-ink">Text message (SMS)</div>
            <div className="text-xs text-gray-400">Get codes by text to your phone.</div>
          </button>
          {allowCancel && (
            <button onClick={onCancel} className="text-xs text-gray-400 underline mt-1">Cancel</button>
          )}
        </div>
      )}

      {method === 'totp' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          {qrCode && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qrCode} alt="Authenticator QR code" className="w-44 h-44 mx-auto mb-3 border border-black/10 rounded-lg bg-white" />
          )}
          <div className="text-xs text-gray-400 text-center mb-4">
            Can’t scan? Enter this key manually:<br />
            <code className="text-[11px] text-ink break-all">{secret}</code>
          </div>
          <form onSubmit={e => { e.preventDefault(); verifyTotp() }}>
            {CodeInput}
            {RememberBox}
            <button type="submit" disabled={busy || code.trim().length < 6} className="btn-primary w-full py-2.5 mt-4">
              {busy ? 'Verifying…' : 'Verify & enable'}
            </button>
          </form>
          <button onClick={() => { setMethod('choose'); setCode(''); setError(null) }} className="text-xs text-gray-400 underline mt-3">← Choose a different method</button>
        </div>
      )}

      {method === 'phone' && (
        <div>
          {!codeSent ? (
            <form onSubmit={e => { e.preventDefault(); sendPhoneCode() }}>
              <label htmlFor="enroll-phone" className="block text-xs text-gray-500 mb-1">Mobile number</label>
              <input id="enroll-phone" type="tel" autoComplete="tel" autoFocus
                className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 415 555 1234" />
              <button type="submit" disabled={busy || !phone.trim()} className="btn-primary w-full py-2.5 mt-4">
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); verifyPhone() }}>
              <p className="text-sm text-gray-500 mb-3">We texted a 6-digit code to {phone}.</p>
              {CodeInput}
              {RememberBox}
              <button type="submit" disabled={busy || code.trim().length < 6} className="btn-primary w-full py-2.5 mt-4">
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
              <button type="button" onClick={sendPhoneCode} disabled={busy} className="text-xs text-brand underline mt-3 disabled:opacity-40">Resend code</button>
            </form>
          )}
          <button onClick={() => { setMethod('choose'); setCode(''); setCodeSent(false); setError(null) }} className="text-xs text-gray-400 underline mt-3 block">← Choose a different method</button>
        </div>
      )}
    </div>
  )
}
