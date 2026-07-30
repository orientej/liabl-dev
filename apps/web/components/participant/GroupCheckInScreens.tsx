'use client'
// Group reservations — Phase 3. The screens that wrap the per-person flow
// when a group leader signs for their whole party on one device:
//   intro  -> (per-person waiver + documents) -> interstitial -> ... -> done
// The per-person flow itself is the unchanged ParticipantFlow; these only
// bookend it, so single-person check-ins are entirely unaffected.
import { useState } from 'react'

export function GroupIntro({ operatorName, onStart }: {
  operatorName?: string
  onStart: (target: number | null) => void
}) {
  const [count, setCount] = useState('')
  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Group check-in</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Signing in your group</h2>
      <p className="text-gray-500 text-sm mb-5">
        You&apos;ll complete a waiver for each person{operatorName ? ` with ${operatorName}` : ''}, one at a time.
        You can add as many people as you need and finish whenever you&apos;re done.
      </p>
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 mb-1">How many people? (optional)</label>
        <input type="number" min="1" className="form-input max-w-[140px]" value={count}
          onChange={e => setCount(e.target.value)} placeholder="e.g. 8" />
        <p className="text-xs text-gray-400 mt-1">Just helps track progress — you can add more or fewer.</p>
      </div>
      <button onClick={() => onStart(count ? Number(count) : null)} className="btn-primary">Start with the first person →</button>
    </div>
  )
}

export function GroupInterstitial({ count, target, onNext, onFinish }: {
  count: number
  target: number | null
  onNext: () => void
  onFinish: () => void
}) {
  const remaining = target ? Math.max(0, target - count) : null
  return (
    <div className="card text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <span className="text-emerald-600 text-2xl">✓</span>
      </div>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Person {count} is all set</h2>
      <p className="text-gray-500 text-sm mb-6">
        {count} waiver{count === 1 ? '' : 's'} signed so far
        {target ? ` · ${remaining} to go` : ''}.
      </p>
      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        <button onClick={onNext} className="btn-primary">Add the next person →</button>
        <button onClick={onFinish} className="btn-secondary">Finish — that&apos;s everyone</button>
      </div>
    </div>
  )
}

export function GroupDone({ count, onDone }: { count: number; onDone: () => void }) {
  return (
    <div className="card text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <span className="text-emerald-600 text-3xl">✓</span>
      </div>
      <h2 className="font-serif text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>Group complete</h2>
      <p className="text-gray-500 text-sm mb-6">
        {count} waiver{count === 1 ? '' : 's'} signed and on file. Everyone in your group is checked in.
      </p>
      <button onClick={onDone} className="btn-primary max-w-xs mx-auto">Start another group</button>
    </div>
  )
}
