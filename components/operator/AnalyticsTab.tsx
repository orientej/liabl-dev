'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  fetchAnalytics, fetchWaiverExportData, exportToCsv,
  formatDelta, getPeriodRange,
  type Period, type AnalyticsData,
} from '@/lib/analytics_OLD_2026-07-08'

// ── Chart components — unchanged from original ────────────────────────────────

function LineChart({ data, color = '#4B2ACF' }: { data: {label:string;value:number}[]; color?:string }) {
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-gray-400">Not enough data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  const w   = 100 / (data.length - 1)
  const pts = data.map((d, i) => `${i * w},${100 - (d.value / max) * 85}`).join(' ')
  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${pts} 100,100`} fill="url(#lg)" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={i} cx={i * w} cy={100 - (d.value / max) * 85} r="2.5" fill={color} />)}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map(d => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, color = '#4B2ACF' }: { data: {label:string;value:number}[]; color?:string }) {
  if (data.length === 0) return <div className="h-28 flex items-center justify-center text-xs text-gray-400">No data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-ink">{d.value}</span>
          <div className="w-full rounded-t-lg" style={{ height:`${(d.value / max) * 80}px`, background:color, opacity:0.8 + (i / data.length) * 0.2 }} />
          <span className="text-xs text-gray-400 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }: { data: {label:string;value:number;color:string}[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="h-28 flex items-center justify-center text-xs text-gray-400">No data</div>
  let offset = 0
  const r = 15.9155, circ = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="w-28 h-28 -rotate-90 shrink-0">
        {data.map((d, i) => {
          const pct = d.value / total, dash = pct * circ, gap = circ - dash
          const el = <circle key={i} r={r} cx="21" cy="21" fill="transparent" stroke={d.color} strokeWidth="5" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset * circ} />
          offset += pct
          return el
        })}
      </svg>
      <div className="space-y-1.5 flex-1">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="flex-1 text-gray-600">{d.label}</span>
            <span className="font-medium text-ink">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton — shown while loading ───────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-black/5 rounded-xl animate-pulse ${className}`} />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsTab() {
  const [period,      setPeriod]      = useState<Period>('month')
  const [data,        setData]        = useState<AnalyticsData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [exporting,   setExporting]   = useState(false)
  const [exportDone,  setExportDone]  = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchAnalytics(p)
      setData(result)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  async function handleExportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const rows = await fetchWaiverExportData()
      exportToCsv(rows)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const range      = getPeriodRange(period)
  const { kpis, charts } = data ?? { kpis: null, charts: null }

  // KPI card definitions — real values when loaded, skeletons while loading
  const kpiCards = kpis ? [
    {
      label: 'Total waivers',
      value: String(kpis.totalWaivers.current),
      delta: formatDelta(kpis.totalWaivers.current, kpis.totalWaivers.prior),
      warn:  false,
    },
    {
      label: 'Completion rate',
      value: `${kpis.completionRate.current}%`,
      delta: formatDelta(kpis.completionRate.current, kpis.completionRate.prior),
      warn:  kpis.completionRate.current < 70,
      note:  'prior period approx.',
    },
    {
      label: 'Avg sign time',
      value: '—',
      delta: 'No flow timer yet',
      warn:  false,
      note:  'requires flow_started_at',
    },
    {
      label: 'High-risk flags',
      value: String(kpis.highRiskFlags.current),
      delta: formatDelta(kpis.highRiskFlags.current, kpis.highRiskFlags.prior),
      warn:  kpis.highRiskFlags.current > 0,
    },
  ] : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">
            Desert Ridge Adventures · {range.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface rounded-xl p-1">
            {(['week', 'month', 'quarter'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  period === p ? 'bg-white text-ink shadow-sm' : 'text-gray-500'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              exportDone
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : exporting
                ? 'bg-surface text-gray-400 border-black/10 cursor-wait'
                : 'bg-white border-black/20 text-gray-600 hover:bg-surface'
            }`}
          >
            {exportDone ? '✓ Downloaded' : exporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{loadError}</span>
          <button onClick={() => load(period)} className="underline ml-1">Retry</button>
        </div>
      )}

      {/* Export error */}
      {exportError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">
          Export failed: {exportError}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {loading || !kpiCards ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-black/10 p-4">
              <Skeleton className="h-7 w-16 mb-2" />
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          kpiCards.map(({ label, value, delta, warn, note }) => (
            <div key={label} className="bg-white rounded-xl border border-black/10 p-4">
              <div className="text-2xl font-semibold text-ink mb-1" style={{ letterSpacing:'-0.02em' }}>
                {value}
              </div>
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <div className={`text-xs font-medium ${warn ? 'text-amber-600' : delta.startsWith('+') ? 'text-emerald-600' : delta.startsWith('-') ? 'text-red-500' : 'text-gray-400'}`}>
                {delta}
                {note && <span className="text-gray-300 ml-1">·</span>}
              </div>
              {note && <div className="text-xs text-gray-300 mt-0.5 italic">{note}</div>}
            </div>
          ))
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

        {/* Waivers signed — line chart */}
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="text-sm font-semibold text-ink mb-1">Waivers signed</div>
          <div className="text-xs text-gray-400 mb-3">Daily — last 30 days</div>
          {loading || !charts ? <Skeleton className="h-28" /> : <LineChart data={charts.trend} />}
        </div>

        {/* Activity breakdown — donut */}
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="text-sm font-semibold text-ink mb-1">Activity breakdown</div>
          <div className="text-xs text-gray-400 mb-3">This {period}</div>
          {loading || !charts ? <Skeleton className="h-28" /> : <DonutChart data={charts.activitySplit} />}
        </div>

        {/* Age distribution — bar chart */}
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="text-sm font-semibold text-ink mb-1">Age distribution</div>
          <div className="text-xs text-gray-400 mb-3">
            By age group · {!loading && charts && charts.ageDist.length === 0
              ? 'no DOB data yet'
              : 'from participant DOB'}
          </div>
          {loading || !charts ? (
            <Skeleton className="h-28" />
          ) : charts.ageDist.length > 0 ? (
            <BarChart data={charts.ageDist} />
          ) : (
            <div className="h-28 flex flex-col items-center justify-center gap-1 text-xs text-gray-400">
              <span>No age data yet</span>
              <span className="text-gray-300">Appears once participants include their date of birth</span>
            </div>
          )}
        </div>

        {/* Risk distribution — donut */}
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="text-sm font-semibold text-ink mb-1">⚡ Risk score distribution</div>
          <div className="text-xs text-gray-400 mb-3">All participants this {period}</div>
          {loading || !charts ? <Skeleton className="h-28" /> : <DonutChart data={charts.riskDist} />}
        </div>
      </div>

      {/* Export options */}
      <div className="bg-surface border border-black/10 rounded-xl p-4">
        <div className="text-sm font-medium text-ink mb-3">Export options</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Real CSV export */}
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="text-left p-3 bg-white rounded-xl border border-black/10 hover:border-brand/30 hover:bg-brand/5 transition-all disabled:opacity-50"
          >
            <div className="text-xl mb-1">📄</div>
            <div className="text-xs font-medium text-ink">Waiver data CSV</div>
            <div className="text-xs text-gray-400 mt-0.5">All signed waivers</div>
          </button>

          {/* Remaining exports — honestly labeled as coming soon */}
          {[
            { label:'Risk score report', icon:'⚡', note:'Coming soon' },
            { label:'Analytics PDF',     icon:'📊', note:'Coming soon' },
            { label:'Incident log',      icon:'🚨', note:'Coming soon' },
          ].map(({ label, icon, note }) => (
            <div key={label} className="text-left p-3 bg-white rounded-xl border border-black/10 opacity-50 cursor-not-allowed">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-xs font-medium text-ink">{label}</div>
              <div className="text-xs text-gray-300 mt-0.5">{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
