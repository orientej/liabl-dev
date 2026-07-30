'use client'
// Group reservations — entry point for a reservation check-in link.
//
//   /participant/reservation?m={member_token}   (personal invite link)
//   /participant/reservation?r={reservation_id} (shared / walk-up link)
//
// reservations/reservation_members have no public-read (PII), so the token
// can't be resolved client-side — we call the admin-client resolve route,
// then forward into the normal participant flow against the reservation's
// bound session, carrying the reservation context in the query so the
// resulting waiver links back (see ParticipantFlow's reservation handling).
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ReservationEntry() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const m = params.get('m')
    const r = params.get('r')
    if (!m && !r) { setError('This check-in link is missing its reservation.'); return }

    const qs = m ? `m=${encodeURIComponent(m)}` : `r=${encodeURIComponent(r as string)}`
    ;(async () => {
      try {
        const res = await fetch(`/api/reservations/resolve?${qs}`)
        const body = await res.json()
        if (!res.ok) { setError(body.error || 'This check-in link could not be opened.'); return }
        const dest = new URLSearchParams()
        dest.set('session', body.sessionId)
        dest.set('reservation', body.reservationId)
        if (m) dest.set('rm', m)   // personal link — bind this member on finish
        if (params.get('g') === '1') dest.set('group', '1')   // group-leader mode
        router.replace(`/participant?${dest.toString()}`)
      } catch {
        setError('Something went wrong opening this check-in. Please try again.')
      }
    })()
  }, [params, router])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="h-14 bg-white border-b border-black/10" />
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {error ? (
            <div className="card text-center">
              <h2 className="font-serif text-xl mb-2" style={{ letterSpacing: '-0.01em' }}>Can&apos;t open this check-in</h2>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          ) : (
            <div className="card animate-pulse">
              <div className="h-3 bg-black/5 rounded w-32 mb-3" />
              <div className="h-6 bg-black/5 rounded w-3/4 mb-2" />
              <div className="h-4 bg-black/5 rounded w-full mb-6" />
              <div className="h-10 bg-black/5 rounded" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
