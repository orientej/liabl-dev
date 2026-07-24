'use client'
import { useState, useEffect } from 'react'
import { fetchOverview, type PlatformOverview } from '@/lib/admin'

export default function ReportingTab() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchOverview())
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load overview')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading overview…</div>
  if (loadError || !data) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  const maxTrend = Math.max(1, ...data.trend.map(t => t.count))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Platform overview</h1>
        <p className="text-sm text-gray-400">Real-time aggregate stats across every operator.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Operators', value: `${data.activeOperators}${data.suspendedOperators ? ` (+${data.suspendedOperators} suspended)` : ''}` },
          { label: 'Team members', value: data.totalMembers },
          { label: 'Total waivers signed', value: data.totalWaivers },
          { label: 'Waivers this month', value: data.waiversThisMonth },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-black/10 p-4">
            <div className="text-2xl font-semibold text-ink" style={{ letterSpacing:'-0.02em' }}>{value}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold text-sm text-ink mb-4">Signatures — last 30 days</h2>
        {data.trend.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No signed waivers in this window yet.</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.trend.map(t => (
              <div key={t.date} className="flex-1 bg-brand/70 rounded-t hover:bg-brand transition-colors" title={`${t.date}: ${t.count}`}
                style={{ height: `${Math.max(4, (t.count / maxTrend) * 100)}%` }} />
            ))}
          </div>
        )}
      </div>

      {data.operatorsNearLimit.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-sm text-ink mb-1">Approaching or over plan limit</h2>
          <p className="text-xs text-gray-400 mb-4">Operators at 85%+ of their monthly signature limit.</p>
          <div className="space-y-2">
            {data.operatorsNearLimit.map(o => (
              <div key={o.operatorId} className="flex items-center justify-between bg-surface rounded-lg p-2.5 text-sm">
                <span className="text-gray-500 font-mono text-xs">{o.operatorId.slice(0, 8)}…</span>
                <span className={o.used >= o.limit ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                  {o.used} / {o.limit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
