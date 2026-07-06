'use client'
import { useState } from 'react'
import { HealthCondition, HealthStatus, ACTIVITY_LABELS } from '@/lib/document-engine'

interface Props {
  onNext:(v:{healthStatus:HealthStatus})=>void
  onBack:()=>void
  answers:Partial<{activityKey:string}>
}

// v23 M1 fix #3 — multi-condition health disclosure
// Participants can now select multiple conditions or none.
// "No known conditions" is the explicit empty-state choice (not a stored value).
const CONDITIONS: { value: HealthCondition; label: string; warning: string }[] = [
  { value:'cardiac', label:'Cardiac or respiratory condition', warning:'A physician clearance clause will be added to your waiver.' },
  { value:'injury',  label:'Recent injury or surgery',         warning:'An injury disclosure clause will be added to your waiver.' },
]

export default function StepHealth({ onNext, onBack, answers }: Props) {
  const [selected, setSelected] = useState<Set<HealthCondition>>(new Set())
  const [noneSelected, setNoneSelected] = useState(false)
  const actLabel = answers.activityKey ? ACTIVITY_LABELS[answers.activityKey as keyof typeof ACTIVITY_LABELS] : 'your activity'

  function toggle(condition: HealthCondition) {
    const next = new Set(selected)
    if (next.has(condition)) next.delete(condition)
    else next.add(condition)
    setSelected(next)
    setNoneSelected(false) // selecting a condition unsets the "none" flag
  }

  function toggleNone() {
    setNoneSelected(v => !v)
    setSelected(new Set()) // selecting "none" clears all condition selections
  }

  const hasMadeChoice = noneSelected || selected.size > 0
  const canContinue = hasMadeChoice

  function submit() {
    if (!canContinue) return
    // Convert Set to array; "none selected" produces an empty array
    onNext({ healthStatus: noneSelected ? [] : Array.from(selected) })
  }

  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 3 of 5 · Adaptive questions</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Health &amp; experience</h2>
      <p className="text-gray-500 text-sm mb-6">Adapting your waiver for <span className="text-brand font-medium">{actLabel}</span> in real time.</p>

      <div className="space-y-2 mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">
          Select all that apply. The waiver will adapt based on your selections.
        </label>

        {/* "No known conditions" — exclusive checkbox */}
        <button
          onClick={toggleNone}
          className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
            noneSelected ? 'border-brand bg-brand/5' : 'border-black/10 bg-surface hover:border-brand/40'
          }`}
        >
          <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
            noneSelected ? 'border-brand bg-brand' : 'border-gray-300'
          }`}>
            {noneSelected && <span className="text-white text-[10px] leading-none">✓</span>}
          </span>
          <span className="text-sm">No known conditions</span>
        </button>

        {/* Multi-select condition checkboxes */}
        {CONDITIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => toggle(value)}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
              selected.has(value) ? 'border-brand bg-brand/5' : 'border-black/10 bg-surface hover:border-brand/40'
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
              selected.has(value) ? 'border-brand bg-brand' : 'border-gray-300'
            }`}>
              {selected.has(value) && <span className="text-white text-[10px] leading-none">✓</span>}
            </span>
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>

      {/* Per-condition warning panels — one shown per selected condition */}
      {CONDITIONS.map(({ value, warning }) => (
        selected.has(value) && (
          <div key={value} className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm mb-2">
            ⚠️ <strong>{warning}</strong>
          </div>
        )
      ))}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={submit} disabled={!canContinue} className="btn-primary">Review document →</button>
      </div>
    </div>
  )
}
