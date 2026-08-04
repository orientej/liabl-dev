'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp, getCurrentOperatorMember, completeOperatorSetup, requestPasswordReset } from '@/lib/auth'
import { getAssuranceLevel, listFactors, type MfaFactor } from '@/lib/mfa'
import { isDeviceTrusted } from '@/lib/trusted-device'
import MfaChallenge from '@/components/operator/MfaChallenge'
import MfaEnroll from '@/components/operator/MfaEnroll'
import { PageNav } from '@liabl/ui'

type Mode = 'signin' | 'signup'
type Phase = 'form' | 'confirmEmail' | 'setup' | 'redirecting'
  | 'forgot' | 'forgotSent' | 'mfaChallenge' | 'mfaEnroll'

interface InvitePreview {
  operatorName: string
  email: string
  role: 'owner' | 'staff'
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland',
  'Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

export default function OperatorLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <OperatorLoginForm />
    </Suspense>
  )
}

function OperatorLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')
  const inviteToken = searchParams.get('invite')

  const [mode, setMode]   = useState<Mode>(inviteToken ? 'signup' : 'signin')
  const [phase, setPhase] = useState<Phase>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // v25 M6+ team invites
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [inviteInvalidReason, setInviteInvalidReason] = useState<string | null>(null)

  // MFA gate — verified factors on the account being signed in, if any.
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([])

  // Organization setup fields (shown only when phase === 'setup')
  const [operatorName, setOperatorName] = useState('')
  const [governingLawState, setGoverningLawState] = useState('')
  const [governingLawCounty, setGoverningLawCounty] = useState('')

  useEffect(() => {
    if (!inviteToken) return
    (async () => {
      try {
        const res = await fetch(`/api/invites/accept?token=${encodeURIComponent(inviteToken)}`)
        const body = await res.json()
        if (!res.ok || !body.valid) {
          setInviteInvalidReason(body.reason ?? 'This invite link is no longer valid')
          return
        }
        setInvitePreview({ operatorName: body.operatorName, email: body.email, role: body.role })
        setEmail(body.email)
      } catch {
        setInviteInvalidReason('Could not verify this invite link')
      }
    })()
  }, [inviteToken])

  // If already logged in (e.g. re-visiting /operator/login directly, or
  // bounced here by middleware with ?mfa=1 because the session is still
  // aal1), route the same way a fresh sign-in would — which now means
  // passing through the MFA gate before reaching the dashboard.
  useEffect(() => {
    (async () => {
      const aal = await getAssuranceLevel()
      if (!aal.currentLevel) return // signed out — show the form
      await routeByAssurance()
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The MFA gate. Called after any successful password authentication and
  // on revisits with an existing session. MFA is required for every
  // operator user, so an aal1 session is never allowed to proceed:
  //   • has a verified factor → step-up challenge
  //   • has none → mandatory enrollment
  // Only an aal2 session falls through to the dashboard/setup routing.
  async function routeByAssurance() {
    const aal = await getAssuranceLevel()
    if (aal.currentLevel !== 'aal2') {
      const factors = await listFactors()
      // No factor yet → mandatory enrollment (a trusted device can't skip
      // the very first setup — trust is only ever granted after a verify).
      if (factors.length === 0) { setPhase('mfaEnroll'); return }
      // Otherwise, a "remembered" device skips the step-up challenge.
      if (await isDeviceTrusted()) { await proceedToDashboardOrSetup(); return }
      setMfaFactors(factors)
      setPhase('mfaChallenge')
      return
    }
    await proceedToDashboardOrSetup()
  }

  async function proceedToDashboardOrSetup() {
    const member = await getCurrentOperatorMember()
    if (member) {
      setPhase('redirecting')
      // A hard navigation, not router.replace(). This redirect follows
      // immediately after a fresh signIn()/signUp() — @supabase/ssr's
      // browser client writes the session cookie via document.cookie,
      // but a client-side router transition can reach middleware.ts
      // before that write is reliably visible to the request, so
      // middleware sees no session yet and bounces back to this same
      // login page — which looks exactly like "stuck on Redirecting,
      // only a manual refresh works." A full navigation guarantees the
      // cookie is attached to a fresh top-level request.
      window.location.href = redirectedFrom || '/operator'
      return
    }

    if (invitePreview && inviteToken) {
      // Logged in, no org yet, and arrived via a still-valid invite —
      // join the inviting operator instead of offering to create a new
      // one. A failure here (e.g. this account already belongs to a
      // different organization) is surfaced directly rather than
      // silently falling through to "create your own org," which could
      // mask a real problem behind what looks like normal onboarding.
      try {
        const res = await fetch('/api/invites/accept', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken }),
        })
        const body = await res.json()
        if (!res.ok || !body.joined) {
          setError(body.error ?? 'Failed to accept invite')
          return
        }
        setPhase('redirecting')
        window.location.href = '/operator'
      } catch {
        setError('Failed to accept invite')
      }
      return
    }

    // Logged in, but no organization linked yet, and no (valid) invite —
    // this covers both a brand-new signup and a returning user whose
    // setup never completed.
    setPhase('setup')
  }

  async function handleSubmit() {
    setError(null)
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
        await routeByAssurance()
      } else {
        const result = await signUp(email.trim(), password)
        if (result.needsEmailConfirmation) {
          setPhase('confirmEmail')
        } else {
          await routeByAssurance()
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotSubmit() {
    setError(null)
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      // Always advance to the same confirmation screen regardless of
      // whether the address had an account — not revealing which emails
      // are registered is deliberate.
      setPhase('forgotSent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetupSubmit() {
    setError(null)
    if (!operatorName.trim() || !governingLawState.trim()) return
    setSubmitting(true)
    try {
      await completeOperatorSetup({ operatorName, governingLawState, governingLawCounty })
      setPhase('redirecting')
      window.location.href = '/operator'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set up your organization')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <PageNav showHomeButton={true} />
      <div className="max-w-sm mx-auto px-4 py-16">

        {phase === 'form' && (
          <div className="card">
            {invitePreview && (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 mb-5 text-sm">
                You&apos;ve been invited to join <span className="font-semibold text-ink">{invitePreview.operatorName}</span> as {invitePreview.role === 'owner' ? 'an owner' : 'a staff member'}.
              </div>
            )}
            {inviteInvalidReason && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
                {inviteInvalidReason}. You can still sign in or create your own account below.
              </div>
            )}

            <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1">
              <button onClick={() => { setMode('signin'); setError(null) }}
                className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${mode==='signin'?'bg-white shadow-sm text-ink':'text-gray-500'}`}>
                Sign In
              </button>
              <button onClick={() => { setMode('signup'); setError(null) }}
                className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${mode==='signup'?'bg-white shadow-sm text-ink':'text-gray-500'}`}>
                Create Account
              </button>
            </div>

            <h1 className="font-serif text-xl mb-1" style={{letterSpacing:'-0.01em'}}>
              {mode === 'signin' ? 'Welcome back' : invitePreview ? `Join ${invitePreview.operatorName}` : 'Create your operator account'}
            </h1>
            <p className="text-sm text-gray-400 mb-5">
              {mode === 'signin' ? 'Sign in to your operator dashboard.' : invitePreview ? 'Set a password to finish joining.' : "You'll set up your organization details next."}
            </p>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

            <form onSubmit={e => { e.preventDefault(); handleSubmit() }}>
              <div className="mb-3">
                <label htmlFor="login-email" className="block text-xs text-gray-500 mb-1">Email</label>
                <input id="login-email" type="email" className="form-input disabled:bg-surface disabled:text-gray-400" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" autoFocus
                  disabled={!!invitePreview}
                  autoComplete="email" name="email" />
              </div>
              <div className="mb-5">
                <label htmlFor="login-password" className="block text-xs text-gray-500 mb-1">Password</label>
                <input id="login-password" type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} name="password" />
                {mode === 'signin' && (
                  <div className="text-right mt-1.5">
                    <button type="button" onClick={() => { setPhase('forgot'); setError(null) }} className="text-xs text-brand hover:underline">
                      Forgot your password?
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting || !email.trim() || !password} className="btn-primary w-full py-2.5">
                {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : invitePreview ? 'Join team' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {phase === 'confirmEmail' && (
          <div className="card text-center">
            <h1 className="font-serif text-xl mb-2" style={{letterSpacing:'-0.01em'}}>Check your email</h1>
            <p className="text-sm text-gray-500">
              We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it, then come back and sign in.
            </p>
            <button onClick={() => { setPhase('form'); setMode('signin') }} className="text-sm text-brand underline mt-4">Back to sign in</button>
          </div>
        )}

        {phase === 'forgot' && (
          <div className="card">
            <h1 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Reset your password</h1>
            <p className="text-sm text-gray-400 mb-5">
              Enter your account email and we&apos;ll send you a link to set a new password. Your email is your username, so this covers a forgotten username too.
            </p>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

            <form onSubmit={e => { e.preventDefault(); handleForgotSubmit() }}>
              <label htmlFor="forgot-email" className="block text-xs text-gray-500 mb-1">Email</label>
              <input id="forgot-email" type="email" autoComplete="email" autoFocus className="form-input mb-4"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
              <button type="submit" disabled={submitting || !email.trim()} className="btn-primary w-full py-2.5">
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <button onClick={() => { setPhase('form'); setError(null) }} className="text-sm text-brand underline mt-4">Back to sign in</button>
          </div>
        )}

        {phase === 'forgotSent' && (
          <div className="card text-center">
            <h1 className="font-serif text-xl mb-2" style={{ letterSpacing: '-0.01em' }}>Check your email</h1>
            <p className="text-sm text-gray-500">
              If an account exists for <span className="font-medium text-ink">{email}</span>, a password-reset link is on its way. The link expires shortly, so use it soon.
            </p>
            <button onClick={() => { setPhase('form'); setMode('signin') }} className="text-sm text-brand underline mt-4">Back to sign in</button>
          </div>
        )}

        {phase === 'mfaChallenge' && (
          <MfaChallenge factors={mfaFactors} showRemember onVerified={() => routeByAssurance()} />
        )}

        {phase === 'mfaEnroll' && (
          <MfaEnroll showRemember onEnrolled={() => routeByAssurance()} />
        )}

        {phase === 'setup' && (
          <div className="card">
            <h1 className="font-serif text-xl mb-1" style={{letterSpacing:'-0.01em'}}>Set up your organization</h1>
            <p className="text-sm text-gray-400 mb-5">This becomes the operator record your activities and waivers belong to.</p>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Organization name</label>
              <input className="form-input" value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="e.g. Desert Ridge Adventures" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Governing law — state</label>
                <select className="form-input" value={governingLawState} onChange={e => setGoverningLawState(e.target.value)}>
                  <option value="">Select…</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">County (optional)</label>
                <input className="form-input" value={governingLawCounty} onChange={e => setGoverningLawCounty(e.target.value)} placeholder="e.g. Maricopa County" />
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-4">This determines the governing-law clause on every waiver you generate — set it to where your business actually operates.</div>

            <button onClick={handleSetupSubmit} disabled={submitting || !operatorName.trim() || !governingLawState.trim()} className="btn-primary w-full py-2.5">
              {submitting ? 'Setting up…' : 'Finish setup'}
            </button>
          </div>
        )}

        {phase === 'redirecting' && (
          <div className="text-center text-sm text-gray-400 py-10">Redirecting…</div>
        )}
      </div>
    </div>
  )
}
