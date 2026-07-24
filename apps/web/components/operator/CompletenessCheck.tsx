'use client'
import { useState } from 'react'
import type { CompletenessResult, ComponentFinding } from '@/lib/completeness-types'

// Waiver completeness check — shared panel for both call sites (the
// upload review screen and an existing template in the Template Builder).
//
// The disclaimer is deliberately not dismissible and sits directly above
// the results rather than in a footnote. This tool reports which common
// components a document contains; it says nothing about whether the
// waiver is enforceable, and operators must not read it that way.
//
// Nothing here is persisted — results live in component state and are
// gone when the operator navigates away. See the route for why.

export default function CompletenessCheck({ clauses, disabledReason }: {
  clauses: { title: string; body: string }[]
  /** When set, the run button is disabled and this explains why. */
  disabledReason?: string
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompletenessResult | null>(null)

  async function run() {
    setRunning(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/templates/completeness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clauses }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Check failed')
      setResult(body as CompletenessResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setRunning(false)
    }
  }

  const core        = result?.findings.filter(f => f.importance === 'core') ?? []
  const situational = result?.findings.filter(f => f.importance === 'situational') ?? []

  return (
    <div className="mt-4 border-t border-black/8 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completeness check</div>
          <div className="text-xs text-gray-400 mt-0.5">
            See which components commonly found in waivers this document contains.
          </div>
        </div>
        <button
          onClick={run}
          disabled={running || !!disabledReason || clauses.length === 0}
          title={disabledReason}
          className="text-xs px-3 py-1.5 rounded-lg border border-brand/30 text-brand bg-brand/5 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {running ? 'Checking…' : result ? 'Run again' : 'Run check'}
        </button>
      </div>

      {disabledReason && !result && (
        <p className="text-xs text-gray-400">{disabledReason}</p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-2">
          {/* Not dismissible, and above the results rather than beneath
              them — this is the framing the findings must be read in. */}
          <div className="bg-surface border border-black/10 rounded-lg p-2.5 mb-3 text-xs text-gray-500">
            <span className="font-medium text-ink">This is not legal advice.</span>{' '}
            It compares your document against components commonly found in waivers. It does not assess whether your
            waiver is enforceable — that depends on your state&apos;s law, your activity, and how the waiver is
            presented and signed. For that, talk to an attorney.
          </div>

          <FindingList title="Commonly included" findings={core} />
          {situational.length > 0 && (
            <FindingList
              title="Situational"
              subtitle="Only relevant to some operations — absence is often correct."
              findings={situational}
            />
          )}

          {result.observations.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes on structure</div>
              <ul className="space-y-1">
                {result.observations.map((o, i) => (
                  <li key={i} className="text-xs text-gray-500 bg-surface rounded-lg px-2.5 py-1.5">{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FindingList({ title, subtitle, findings }: {
  title: string; subtitle?: string; findings: ComponentFinding[]
}) {
  if (findings.length === 0) return null
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mb-1.5">{subtitle}</div>}
      <div className={`space-y-1 ${subtitle ? '' : 'mt-1.5'}`}>
        {findings.map(f => (
          <div key={f.key} className="flex items-start gap-2 bg-white border border-black/10 rounded-lg px-2.5 py-2">
            <StatusDot status={f.status} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-ink">{f.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{f.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: ComponentFinding['status'] }) {
  // Missing situational components shouldn't look like failures, so the
  // palette stays neutral: this marks what was found, not what's wrong.
  const style =
    status === 'present' ? { cls: 'bg-emerald-100 text-emerald-700', ch: '✓' } :
    status === 'partial' ? { cls: 'bg-amber-100 text-amber-700',    ch: '~' } :
                           { cls: 'bg-gray-100 text-gray-400',      ch: '–' }
  return (
    <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${style.cls}`}>
      {style.ch}
    </span>
  )
}
