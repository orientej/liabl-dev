'use client'

export interface RiskFactors {
  age?: number
  activityKey?: string
  // v23 M1 fix #3 — healthStatus is now an array of conditions.
  // Accepts the legacy single-string shape too for backwards compatibility
  // with any waivers written before the migration runs.
  healthStatus?: string | string[]
  experienceLevel?: string
  isMinor?: boolean
}

export function calculateRiskScore(factors: RiskFactors): { score: number; level: 'low' | 'moderate' | 'elevated' | 'high'; factors: string[] } {
  let score = 0
  const contributing: string[] = []

  // Activity base risk
  const activityRisk: Record<string, number> = { kayak:35, climb:30, atv:25, hike:15 }
  if (factors.activityKey) { score += activityRisk[factors.activityKey] ?? 20; contributing.push('Activity type') }

  // v23 M1 fix #3 — Health (multi-condition aware)
  // Normalize to array regardless of input shape, then check each condition.
  // Both conditions can contribute to the score simultaneously.
  const conditions: string[] = Array.isArray(factors.healthStatus)
    ? factors.healthStatus
    : factors.healthStatus && factors.healthStatus !== 'none'
      ? [factors.healthStatus]
      : []

  if (conditions.includes('cardiac')) { score += 30; contributing.push('Cardiovascular condition disclosed') }
  if (conditions.includes('injury'))  { score += 20; contributing.push('Recent injury disclosed') }

  // Age
  if (factors.age) {
    if (factors.age < 18)   { score += 15; contributing.push('Minor participant') }
    if (factors.age > 60)   { score += 10; contributing.push('Age 60+') }
    if (factors.age >= 18 && factors.age <= 35) { score -= 5 }
  }

  // Experience
  if (factors.experienceLevel === 'none')     { score += 15; contributing.push('No prior experience') }
  if (factors.experienceLevel === 'advanced') { score -= 10 }

  score = Math.max(0, Math.min(100, score))

  const level = score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'elevated' : 'high'
  return { score, level, factors: contributing }
}

interface Props {
  factors:  RiskFactors
  compact?: boolean
}

const LEVEL_CONFIG = {
  low:      { color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200', bar:'bg-emerald-500', label:'Low risk' },
  moderate: { color:'text-blue-600',    bg:'bg-blue-50',    border:'border-blue-200',    bar:'bg-blue-500',    label:'Moderate risk' },
  elevated: { color:'text-amber-600',   bg:'bg-amber-50',   border:'border-amber-200',   bar:'bg-amber-500',   label:'Elevated risk' },
  high:     { color:'text-red-600',     bg:'bg-red-50',     border:'border-red-200',     bar:'bg-red-500',     label:'High risk' },
}

export default function RiskScore({ factors, compact = false }: Props) {
  const { score, level, factors: contributing } = calculateRiskScore(factors)
  const cfg = LEVEL_CONFIG[level]

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
        <span>⚡</span>
        <span>{cfg.label}</span>
        <span className="font-mono">{score}</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`font-semibold text-sm ${cfg.color}`}>⚡ Intelligent Risk Profile</div>
        <div className={`font-mono text-2xl font-bold ${cfg.color}`}>{score}</div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
          <span className="text-gray-400">out of 100</span>
        </div>
        <div className="h-2 bg-black/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{ width:`${score}%` }} />
        </div>
      </div>

      {contributing.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1.5">Contributing factors:</div>
          <div className="flex flex-wrap gap-1.5">
            {contributing.map(f => (
              <span key={f} className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>{f}</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
        {level === 'high'     && 'Supervisor review recommended before activity commencement.'}
        {level === 'elevated' && 'Additional safety briefing recommended. Notify lead guide.'}
        {level === 'moderate' && 'Standard procedures apply. Monitor during activity.'}
        {level === 'low'      && 'No additional precautions required.'}
      </p>
    </div>
  )
}
