'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { IMPERSONATION_FLAG_KEY } from '@/lib/supabase'

export default function ImpersonateVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ImpersonateVerifyForm />
    </Suspense>
  )
}

function ImpersonateVerifyForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const tokenHash = searchParams.get('token')
      const targetEmail = searchParams.get('email')
      const operatorName = searchParams.get('operator')
      const targetUserId = searchParams.get('targetUserId')
      const targetOperatorId = searchParams.get('targetOperatorId')
      const adminUserId = searchParams.get('adminId')
      const adminEmail = searchParams.get('adminEmail')

      if (!tokenHash || !targetEmail) {
        setError('Missing or invalid impersonation link.')
        return
      }

      // Set the flag BEFORE calling createClient() — that factory checks
      // this flag to decide whether to return the sessionStorage-backed
      // client (what we need here) or the normal cookie-based one.
      sessionStorage.setItem(IMPERSONATION_FLAG_KEY, 'true')

      try {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })

        if (verifyError) {
          sessionStorage.removeItem(IMPERSONATION_FLAG_KEY)
          setError(verifyError.message)
          return
        }

        sessionStorage.setItem('liabl_impersonation_started_at', Date.now().toString())
        sessionStorage.setItem('liabl_impersonation_target_email', targetEmail)
        sessionStorage.setItem('liabl_impersonation_operator_name', operatorName ?? '')
        if (targetUserId)      sessionStorage.setItem('liabl_impersonation_target_user_id', targetUserId)
        if (targetOperatorId)  sessionStorage.setItem('liabl_impersonation_target_operator_id', targetOperatorId)
        if (adminUserId)       sessionStorage.setItem('liabl_impersonation_admin_id', adminUserId)
        if (adminEmail)        sessionStorage.setItem('liabl_impersonation_admin_email', adminEmail)

        window.location.href = '/operator?impersonating=1'
      } catch (e) {
        sessionStorage.removeItem(IMPERSONATION_FLAG_KEY)
        setError(e instanceof Error ? e.message : 'Failed to start impersonation session')
      }
    })()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="card max-w-sm text-center">
        {error ? (
          <>
            <h1 className="font-serif text-xl mb-2" style={{ letterSpacing:'-0.01em' }}>Couldn&apos;t start impersonation</h1>
            <p className="text-sm text-gray-500">{error}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Starting impersonation session…</p>
        )}
      </div>
    </div>
  )
}
