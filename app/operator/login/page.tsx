'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp, getCurrentOperatorMember, completeOperatorSetup } from '@/lib/auth'
import PageNav from '@/components/PageNav'

type Mode = 'signin' | 'signup'
type Phase = 'form' | 'confirmEmail' | 'setup' | 'redirecting'

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

  // If already logged in (e.g. re-visiting /operator/login directly),
  // route the same way a fresh sign-in would.
  useEffect(() => {
    (async () => {
      const member = await getCurrentOperatorMember()
      if (member) {
        setPhase('redirecting')
        router.replace(redirectedFrom || '/operator')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function afterAuthSuccess() {
    const member = await getCurrentOperatorMember()
    if (member) {
      setPhase('redirecting')
      router.replace(redirectedFrom || '/operator')
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
        router.replace('/operator')
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
        await afterAuthSuccess()
      } else {
        const result = await signUp(email.trim(), password)
        if (result.needsEmailConfirmation) {
          setPhase('confirmEmail')
        } else {
          await afterAuthSuccess()
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
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
      router.replace('/operator')
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

            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" className="form-input disabled:bg-surface disabled:text-gray-400" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="you@company.com" autoFocus
                disabled={!!invitePreview} />
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="••••••••" />
            </div>

            <button onClick={handleSubmit} disabled={submitting || !email.trim() || !password} className="btn-primary w-full py-2.5">
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : invitePreview ? 'Join team' : 'Create Account'}
            </button>
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
