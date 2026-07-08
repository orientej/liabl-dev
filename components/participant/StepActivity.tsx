'use client'
import { useState } from 'react'
import { ActivityKey, ActivityRecord } from '@/lib/document-engine_OLD_2026-07-08'
import { getActivityIcon } from '@/components/activity-icon'

interface Props {
  activities: ActivityRecord[]
  onNext: (v: { activityKey: ActivityKey }) => void
  onBack: () => void
}

export default function StepActivity({ activities, onNext, onBack }: Props) {
  const [selected, setSelected] = useState<ActivityKey | null>(null)

  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 2 of 5</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>What&apos;s your activity today?</h2>
      <p className="text-gray-500 text-sm mb-6">Your waiver will be <span className="text-brand font-medium">tailored to the specific risks</span> involved.</p>

      {activities.length === 0 ? (
        <div className="mb-6 text-sm text-gray-400 py-8 text-center">Loading activities…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {activities.map(({ key, displayName, subtitle, icon, accentColor }) => {
            const Icon = getActivityIcon(icon)
            return (
              <button key={key} onClick={() => setSelected(key)} className={`text-left p-4 rounded-xl border transition-all ${selected===key?'border-brand bg-brand/5':'border-black/10 bg-surface hover:border-brand/40'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:accentColor }}>
                  <Icon size={22} color="#FFFFFF"/>
                </div>
                <div className="font-semibold text-sm">{displayName}</div>
                {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={()=>selected&&onNext({activityKey:selected})} disabled={!selected} className="btn-primary">Continue →</button>
      </div>
    </div>
  )
}
