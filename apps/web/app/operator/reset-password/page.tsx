'use client'
// Landing page for the "reset password" email link. The link carries a
// short-lived recovery grant; Supabase turns it into a recovery session
// (either a ?code= we exchange, PKCE, or a #hash the client detects,
// implicit — we handle both). With that session in hand the user can set
// a new password via updateUser(). We then sign them straight back out so
// their next sign-in goes through the normal MFA gate — a password reset
// must not be a way to slip past two-factor.
//
// This route is public (see middleware.ts PUBLIC_OPERATOR_PATHS): the
// whole point is that it works for someone who cannot currently log in.
import { useState, useEffect, Suspense } from 'react'
import { PageNav } from '@liabl/ui'
import { createClient } from '@/lib/supabase'
import { updatePassword, signOut } from '@/lib/auth'

type Status = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let settled = false
    const markReady = () => { if (!settled) { settled = true; setStatus('ready') } }

    // Implicit (hash) flow surfaces the recovery session as an auth event.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) markReady()
    })

    ;(async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) { markReady(); return }
        }
        const { data } = await supabase.auth.getSession()
        if (data.session) { markReady(); return }
      } catch {
        /* fall through to the timeout below */
      }
      // Give the hash-based event a moment to fire before giving up.
      setTimeout(() => { if (!settled) { settled = true; setStatus('invalid') } }, 2500)
    })()

    return () => sub.subscription.unsubscribe()
  }, [])

  async function submit() {
    setError(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords don’t match.'); return }
    setSaving(true)
    try {
      await updatePassword(password)
      // Clear the recovery session so the next login is a clean,
      // MFA-gated sign-in rather than an already-authenticated jump-in.
      await signOut().catch(() => {})
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <PageNav showHomeButton={true} />
      <div className="max-w-sm mx-auto px-4 py-16">
        {status === 'checking' && (
          <div className="text-center text-sm text-gray-400 py-10">Verifying your reset link…</div>
        )}

        {status === 'invalid' && (
          <div className="card text-center">
            <h1 className="font-serif text-xl mb-2" style={{ letterSpacing: '-0.01em' }}>Link expired</h1>
            <p className="text-sm text-gray-500 mb-4">
              This password-reset link is invalid or has already been used. Request a new one from the sign-in page.
            </p>
            <a href="/operator/login" className="text-sm text-brand underline">Back to sign in</a>
          </div>
        )}

        {status === 'ready' && (
          <div className="card">
            <h1 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Choose a new password</h1>
            <p className="text-sm text-gray-400 mb-5">Set a new password for your operator account.</p>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

            <form onSubmit={e => { e.preventDefault(); submit() }}>
              <div className="mb-3">
                <label htmlFor="new-pw" className="block text-xs text-gray-500 mb-1">New password</label>
                <input id="new-pw" type="password" autoComplete="new-password" autoFocus className="form-input"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="mb-5">
                <label htmlFor="confirm-pw" className="block text-xs text-gray-500 mb-1">Confirm password</label>
                <input id="confirm-pw" type="password" autoComplete="new-password" className="form-input"
                  value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={saving || !password || !confirm} className="btn-primary w-full py-2.5">
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </div>
        )}

        {status === 'done' && (
          <div className="card text-center">
            <h1 className="font-serif text-xl mb-2" style={{ letterSpacing: '-0.01em' }}>Password updated</h1>
            <p className="text-sm text-gray-500 mb-4">
              Your password has been changed. Sign in with your new password — you’ll confirm your second factor as usual.
            </p>
            <a href="/operator/login" className="btn-primary inline-block px-5 py-2.5">Go to sign in</a>
          </div>
        )}
      </div>
    </div>
  )
}
