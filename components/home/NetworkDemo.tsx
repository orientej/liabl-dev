'use client'
import { useState } from 'react'

function calcRecognition(operators: number): number {
  // Logarithmic growth curve: recognition compounds as network grows
  if (operators < 10)   return Math.round(operators * 0.8)
  if (operators < 100)  return Math.round(8 + (operators - 10) * 0.35)
  if (operators < 1000) return Math.round(39 + (operators - 100) * 0.022)
  if (operators < 5000) return Math.round(59 + (operators - 1000) * 0.00225)
  return Math.min(68 + Math.round((operators - 5000) * 0.0005), 89)
}

const MILESTONES = [
  { ops:100,  label:'100 operators',  note:'Early adopters — local recognition begins' },
  { ops:500,  label:'500 operators',  note:'Regional network — 30%+ recognition in metro areas' },
  { ops:1000, label:'1K operators',   note:'Statewide coverage — most active participants recognized' },
  { ops:5000, label:'5K operators',   note:'National presence — 68% recognition; moat is defensible' },
  { ops:10000,label:'10K operators',  note:'Category default — new operators join for the graph, not the product' },
]

export default function NetworkDemo() {
  const [operators, setOperators] = useState(500)
  const recognition = calcRecognition(operators)
  const milestone   = [...MILESTONES].reverse().find(m => operators >= m.ops)

  const barColor =
    recognition < 20 ? '#6366F1' :
    recognition < 40 ? '#818CF8' :
    recognition < 60 ? '#A78BFA' :
    recognition < 75 ? '#C4B5FD' : '#DDD6FE'

  return (
    <div>
      {/* Main stat */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <div className="text-6xl font-serif font-bold text-white" style={{ letterSpacing:'-0.03em' }}>
            {recognition}<span className="text-3xl text-white/60">%</span>
          </div>
          <div className="text-white/60 text-sm mt-1">of participants arrive already recognized</div>
        </div>
        <div className="flex-1 pb-2">
          <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all duration-500" style={{ width:`${recognition}%`, background:barColor }}/>
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-white/60 mb-2">
          <span>Operators on LIABL</span>
          <span className="font-mono text-white font-medium">{operators.toLocaleString()}</span>
        </div>
        <input type="range" min={1} max={10000} step={50} value={operators}
          onChange={e => setOperators(Number(e.target.value))}
          className="w-full accent-violet-400 cursor-pointer"
          style={{ accentColor:'#A78BFA' }}
        />
        <div className="flex justify-between text-xs text-white/30 mt-1">
          <span>1</span><span>2.5K</span><span>5K</span><span>7.5K</span><span>10K</span>
        </div>
      </div>

      {/* Milestone callout */}
      {milestone && (
        <div className="bg-white/10 rounded-xl p-4 mb-4 animate-fade-up">
          <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">{milestone.label}</div>
          <p className="text-sm text-white/80 leading-relaxed">{milestone.note}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'New operator benefit', value:`${recognition}% day-one recognition` },
          { label:'Avg sign time (returning)', value: recognition > 40 ? '~15 sec' : '~90 sec' },
          { label:'Network defensibility', value: operators >= 5000 ? 'Defensible moat' : operators >= 1000 ? 'Building' : 'Early stage' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-sm font-semibold text-white mb-1">{value}</div>
            <div className="text-xs text-white/50 leading-snug">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
