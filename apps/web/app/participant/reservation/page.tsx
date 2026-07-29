// Group reservations — /participant/reservation entry point. Mirrors
// app/participant/page.tsx: a minimal server component that renders the
// client entry inside a Suspense boundary (required because it reads the
// URL via useSearchParams).
import { Suspense } from 'react'
import ReservationEntry from './ReservationEntry'

function EntrySkeleton() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="h-14 bg-white border-b border-black/10" />
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="card animate-pulse">
            <div className="h-3 bg-black/5 rounded w-32 mb-3" />
            <div className="h-6 bg-black/5 rounded w-3/4 mb-2" />
            <div className="h-4 bg-black/5 rounded w-full mb-6" />
            <div className="h-10 bg-black/5 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReservationEntryPage() {
  return (
    <Suspense fallback={<EntrySkeleton />}>
      <ReservationEntry />
    </Suspense>
  )
}
