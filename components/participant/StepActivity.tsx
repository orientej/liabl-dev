'use client'
import { useState } from 'react'
import { ActivityKey, ACTIVITY_LABELS } from '@/lib/document-engine'
import { IconKayak, IconHike, IconATV, IconClimb } from '@/components/icons'

interface Props { onNext:(v:{activityKey:ActivityKey})=>void; onBack:()=>void }

const ACTS: { key:ActivityKey; Icon:React.ComponentType<{size?:number;color?:string}>; sub:string; bg:string }[] = [
  { key:'kayak', Icon:IconKayak, sub:'Class III–IV rapids',          bg:'#4B2ACF' },
  { key:'hike',  Icon:IconHike,  sub:'Technical canyon terrain',     bg:'#15803D' },
  { key:'atv',   Icon:IconATV,   sub:'Off-road vehicles',            bg:'#EA580C' },
  { key:'climb', Icon:IconClimb, sub:'Top-rope & lead',              bg:'#0891B2' },
]

export default function StepActivity({ onNext, onBack }: Props) {
  const [selected,setSelected]=useState<ActivityKey|null>(null)
  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 2 of 5</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>What&apos;s your activity today?</h2>
      <p className="text-gray-500 text-sm mb-6">Your waiver will be <span className="text-brand font-medium">tailored to the specific risks</span> involved.</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTS.map(({ key, Icon, sub, bg })=>(
          <button key={key} onClick={()=>setSelected(key)} className={`text-left p-4 rounded-xl border transition-all ${selected===key?'border-brand bg-brand/5':'border-black/10 bg-surface hover:border-brand/40'}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:bg }}>
              <Icon size={22} color="#FFFFFF"/>
            </div>
            <div className="font-semibold text-sm">{ACTIVITY_LABELS[key]}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={()=>selected&&onNext({activityKey:selected})} disabled={!selected} className="btn-primary">Continue →</button>
      </div>
    </div>
  )
}
