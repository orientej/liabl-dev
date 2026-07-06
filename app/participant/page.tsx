// v23 M1 fix #1 (build fix) — Suspense wrapper for useSearchParams
//
// The participant flow uses useSearchParams() to read the session ID from
// the URL. Next.js 14's App Router requires useSearchParams() to be inside
// a <Suspense> boundary during static prerendering — otherwise the build
// fails with "useSearchParams() should be wrapped in a suspense boundary".
//
// This page is intentionally minimal: it does nothing but render the
// ParticipantFlow client component inside a Suspense boundary. All the
// signing-flow logic lives in ParticipantFlow.tsx.

import { Suspense } from 'react'
import ParticipantFlow from './ParticipantFlow'

// Skeleton shown briefly before the client component hydrates. Matches the
// general visual shape of the participant flow (surface background, centered
// content) so there's no visible jump.
function ParticipantSkeleton() {
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

export default function ParticipantPage() {
  return (
    <Suspense fallback={<ParticipantSkeleton />}>
      <ParticipantFlow />
    </Suspense>
  )
}
