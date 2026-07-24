'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from '@/lib/auth'
import { getCurrentAdmin } from '@/lib/admin-auth'
import { PageNav } from '@liabl/ui'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    (async () => {
      const admin = await getCurrentAdmin()
      if (admin) {
        window.location.href = '/admin'
        return
      }
      setChecking(false)
    })()
  }, [])

  async function handleSubmit() {
    setError(null)
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      const admin = await getCurrentAdmin()
      if (!admin) {
        // Authenticated successfully, but not an admin — this account
        // is not provisioned in liabl_admins. Sign back out rather than
        // leaving a normal (or nonexistent) admin session half-logged-in
        // against this console.
        await signOut()
        setError('This account is not authorized for admin access.')
        return
      }
      // Hard navigation, not router.replace() — same cookie-propagation
      // race as the operator login page; see that file's comment for
      // the full explanation.
      window.location.href = '/admin'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return <div className="min-h-screen bg-surface" />
  }

  return (
    <div className="min-h-screen bg-surface">
      <PageNav showHomeButton={true} />
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="card">
          <h1 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>LIABL Admin</h1>
          <p className="text-sm text-gray-400 mb-5">Internal support console. Access is provisioned individually — there is no self-serve signup here.</p>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{error}</div>}

          <form onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <div className="mb-3">
              <label htmlFor="admin-email" className="block text-xs text-gray-500 mb-1">Email</label>
              <input id="admin-email" type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@liabl.app" autoFocus autoComplete="email" name="email" />
            </div>
            <div className="mb-5">
              <label htmlFor="admin-password" className="block text-xs text-gray-500 mb-1">Password</label>
              <input id="admin-password" type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" name="password" />
            </div>
            <button type="submit" disabled={submitting || !email.trim() || !password} className="btn-primary w-full py-2.5">
              {submitting ? 'Please wait…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
