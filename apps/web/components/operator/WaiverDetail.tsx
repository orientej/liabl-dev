// WaiverDetail.tsx — extracted component, replaces the inline WaiverDetail
// inside RosterTab.tsx so the audit-trail fetch doesn't clutter that file.
// Import and use in RosterTab exactly where WaiverDetail was inline.
//
// v24 M2 item 4 — real audit trail from audit_events table

'use client'
import { useState, useEffect } from 'react'
import { calculateRiskScore } from '@/components/RiskScore'
import { fetchWaiverAuditTrail, type AuditEvent } from '@/lib/audit'
import type { ActivityRecord } from '@/lib/document-engine'

interface Participant { full_name: string; email: string }

export interface WaiverDetailRow {
  id: string
  signed_at: string | null
  activity_key: string
  is_minor: boolean
  ip_address: string | null
  document_hash: string | null
  pdf_path: string | null
  redacted_at: string | null
  seal_error: string | null
  answers: Record<string, unknown> | null
  clauses: WaiverClause[] | null
  session_id: string | null
  participants: Participant | null
}

interface WaiverClause {
  id: string; title: string; body: string; highlight?: boolean; required: boolean
}

// Activity label now comes from the activities table via the `activities`
// prop (fetched once by RosterTab and passed down) instead of a local
// hardcoded map.

const RISK_STYLES: Record<string, { badge:string; bar:string; label:string }> = {
  low:      { badge:'text-emerald-700 bg-emerald-50 border-emerald-200', bar:'bg-emerald-500', label:'Low Risk'      },
  moderate: { badge:'text-blue-700    bg-blue-50    border-blue-200',    bar:'bg-blue-500',    label:'Moderate Risk' },
  elevated: { badge:'text-amber-700   bg-amber-50   border-amber-200',   bar:'bg-amber-500',   label:'Elevated Risk' },
  high:     { badge:'text-red-700     bg-red-50     border-red-200',     bar:'bg-red-500',     label:'High Risk'     },
}

// Human-readable labels for each event type in the timeline
const EVENT_LABELS: Record<string, string> = {
  'session.started':   'Session started',
  'waiver.generated':  'Adaptive document generated',
  'document.viewed':   'Document reviewed',
  'waiver.signed':     'Waiver signed',
  'document.sealed':   'Document sealed',
}

function ageFromDob(dob: unknown): number | undefined {
  if (typeof dob !== 'string' || !dob) return undefined
  const ms = Date.now() - new Date(dob).getTime()
  if (isNaN(ms)) return undefined
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25))
}

export default function WaiverDetail({
  row,
  index,
  isDemo,
  activities,
  onClose,
}: {
  row: WaiverDetailRow
  index: number
  isDemo: boolean
  activities: ActivityRecord[]
  onClose: () => void
}) {
  const activity = activities.find(a => a.key === row.activity_key)
  const activityLabel = activity?.displayName ?? row.activity_key
  const name   = row.participants?.full_name ?? 'Unknown'
  const email  = row.participants?.email ?? ''
  const time   = row.signed_at
    ? new Date(row.signed_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
    : '—'
  const docId  = `doc_${row.id.slice(0, 8)}`

  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError,   setPdfError]   = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent,    setEmailSent]    = useState(false)
  const [emailError,   setEmailError]   = useState<string | null>(null)

  // v25 M6 security review — replaces opening a stored long-lived signed
  // URL directly. Generates a fresh, short-lived one on demand instead;
  // see app/api/waivers/[id]/pdf-url/route.ts.
  async function openPdf() {
    setPdfError(null)
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/waivers/${row.id}/pdf-url`)
      const body = await res.json()
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Failed to open document')
      window.open(body.url, '_blank')
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Failed to open document')
    } finally {
      setPdfLoading(false)
    }
  }

  // Reuses the same route the participant flow already fires
  // automatically right after signing (app/api/waivers/[id]/send-
  // confirmation) — this button just lets staff trigger it again on
  // demand, e.g. if a participant says they never received it.
  async function sendEmailCopy() {
    setEmailError(null)
    setEmailSent(false)
    setEmailLoading(true)
    try {
      const res = await fetch(`/api/waivers/${row.id}/send-confirmation`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok || !body.sent) throw new Error(body.error ?? body.reason ?? 'Failed to send email')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 4000)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setEmailLoading(false)
    }
  }


  const answers = row.answers ?? {}
  const age     = ageFromDob(answers.dob)
  const risk    = calculateRiskScore({
    activityKey:      row.activity_key,
    activityBaseRisk: activity?.baseRiskScore,
    isMinor:          row.is_minor,
    healthStatus:     answers.healthStatus as string | string[] | undefined,
    age,
    experienceLevel: answers.experienceLevel as string | undefined,
  })
  const rs = RISK_STYLES[risk.level]

  const clauses          = row.clauses ?? []
  const hasRealClauses   = clauses.length > 0

  // ── Real audit trail fetch ──────────────────────────────────────────────
  const [auditEvents,  setAuditEvents]  = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError,   setAuditError]   = useState(false)

  useEffect(() => {
    if (isDemo || !row.signed_at) {
      setAuditLoading(false)
      return
    }
    fetchWaiverAuditTrail(row.id, row.session_id)
      .then(events => {
        setAuditEvents(events)
        setAuditLoading(false)
      })
      .catch(() => {
        setAuditError(true)
        setAuditLoading(false)
      })
  }, [row.id, row.session_id, row.signed_at, isDemo])

  return (
    <div className="border-t border-brand/20 bg-brand/5 animate-fade-up">
      <div className="px-5 py-5">

        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700 flex items-center gap-2">
            <span>⚠</span> Sample data — this participant has not actually signed. Detail fields below are illustrative only.
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="font-semibold text-ink">{name}</div>
            <div className="text-xs text-gray-400">{email} · {activityLabel} · Signed {time}</div>
            <div className="font-mono text-xs text-gray-400 mt-0.5">{docId}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-ink text-lg leading-none">×</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Left — participant info + signed clauses */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-black/10 p-4 space-y-2 text-xs">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Participant</div>
              {[
                { l:'Full name',   v: name },
                { l:'Email',       v: email },
                { l:'Minor',       v: row.is_minor ? 'Yes — guardian signed' : 'No' },
                { l:'Signed at',   v: time },
                { l:'IP address',  v: row.ip_address ?? '—' },
                { l:'Doc ID',      v: docId },
                { l:'SHA-256',     v: row.document_hash
                    ? `${row.document_hash.slice(0,4)}…${row.document_hash.slice(-4)}`
                    : 'Pending — not yet hashed' },
                { l:'Legal basis', v: 'ESIGN Act · UETA' },
              ].map(({ l, v }) => (
                <div key={l} className="flex gap-3">
                  <span className="text-gray-400 w-24 shrink-0">{l}</span>
                  <span className={`font-mono font-medium truncate ${
                    v.startsWith('Pending') || v === '—' ? 'text-gray-400 italic' : 'text-ink'
                  }`}>{v}</span>
                </div>
              ))}
            </div>

            {/* Signed clauses */}
            <div className="bg-white rounded-xl border border-black/10 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Signed Clauses</span>
                {!hasRealClauses && <span className="text-amber-600 font-medium normal-case">No clauses stored</span>}
              </div>
              {hasRealClauses ? (
                clauses.map((c, i) => (
                  <div key={c.id ?? i} className={`px-4 py-3 border-b border-black/5 last:border-0 ${c.highlight ? 'bg-brand/5' : ''}`}>
                    <div className={`text-xs font-semibold mb-0.5 ${c.highlight ? 'text-brand' : 'text-gray-500'}`}>
                      {c.highlight && '⚡ '}{c.title}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{c.body}</p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-xs text-gray-400">
                  {row.signed_at
                    ? 'This waiver was signed before clauses were stored. The participant\'s copy is authoritative.'
                    : 'Waiver not yet signed.'}
                </div>
              )}
            </div>
          </div>

          {/* Right — risk profile + audit trail + actions */}
          <div className="space-y-3">

            {/* Risk profile */}
            <div className={`rounded-xl border p-4 ${rs.badge.split(' ').slice(1).join(' ')}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-0.5">⚡ Intelligent Risk Profile</div>
                  <div className={`text-xs font-medium ${rs.badge.split(' ')[0]}`}>{rs.label}</div>
                  {age !== undefined && (
                    <div className="text-xs opacity-60 mt-0.5">Age {age} · {activityLabel}</div>
                  )}
                </div>
                <div className={`font-mono text-3xl font-bold ${rs.badge.split(' ')[0]}`}>{risk.score}</div>
              </div>
              <div className="mb-3">
                <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${rs.bar}`} style={{ width:`${risk.score}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1 opacity-60"><span>0</span><span>50</span><span>100</span></div>
              </div>
              {risk.factors.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium mb-1.5 opacity-70">Contributing factors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {risk.factors.map(f => (
                      <span key={f} className={`text-xs px-2 py-0.5 rounded-full border bg-white/50 ${rs.badge.split(' ')[0]}`}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs leading-relaxed opacity-80">
                {risk.level === 'high'     && 'Supervisor review recommended before activity commencement.'}
                {risk.level === 'elevated' && 'Additional safety briefing recommended. Notify lead guide.'}
                {risk.level === 'moderate' && 'Standard procedures apply. Monitor during activity.'}
                {risk.level === 'low'      && 'No additional precautions required.'}
              </p>
            </div>

            {/* Audit trail — real events from audit_events table */}
            <div className="bg-white rounded-xl border border-black/10 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Audit Trail
              </div>

              {auditLoading && (
                <div className="px-4 py-4 text-xs text-gray-400">Loading audit trail…</div>
              )}

              {auditError && (
                <div className="px-4 py-4 text-xs text-red-500">Couldn't load audit events.</div>
              )}

              {!auditLoading && !auditError && auditEvents.length === 0 && !isDemo && (
                <div className="px-4 py-4 text-xs text-gray-400">
                  No audit events recorded for this waiver. Events are captured for waivers signed after the audit trail was deployed.
                </div>
              )}

              {/* Demo placeholder trail when no real events */}
              {isDemo && (
                <div className="px-4 py-3 text-xs text-gray-300 italic">
                  Audit trail not available for sample data.
                </div>
              )}

              {/* Real events */}
              {!auditLoading && !auditError && auditEvents.map((ev) => {
                const label = EVENT_LABELS[ev.eventType] ?? ev.eventType
                const evTime = new Date(ev.createdAt).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })
                const isSealed = ev.eventType === 'document.sealed'
                return (
                  <div key={ev.id} className="flex items-start gap-2 px-4 py-2.5 border-b border-black/5 last:border-0 text-xs">
                    <span className="font-mono text-gray-400 shrink-0 w-16">{evTime}</span>
                    <span className={`px-1.5 py-0.5 rounded-full shrink-0 ${
                      isSealed ? 'bg-emerald-50 text-emerald-700' : 'bg-brand/10 text-brand'
                    }`}>{ev.eventType}</span>
                    <span className="text-gray-400 leading-relaxed">
                      {label}
                      {ev.metadata?.hashPreview && ` · SHA-256: ${ev.metadata.hashPreview}`}
                      {ev.metadata?.clauseCount !== undefined && ` · ${ev.metadata.clauseCount} clauses`}
                      {ev.ipAddress && ev.eventType === 'waiver.signed' && ` · IP ${ev.ipAddress}`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {row.pdf_path ? (
                <button
                  onClick={openPdf}
                  disabled={pdfLoading}
                  className="text-xs px-3 py-2 rounded-xl border border-brand/30 text-brand bg-brand/5 hover:bg-brand/10 transition-colors flex-1 disabled:opacity-50"
                >
                  {pdfLoading ? 'Opening…' : '↓ Download PDF'}
                </button>
              ) : (
                <button disabled className="text-xs px-3 py-2 rounded-xl border border-black/20 text-gray-400 flex-1 cursor-not-allowed">
                  ↓ Download PDF
                </button>
              )}
              {email ? (
                <button
                  onClick={sendEmailCopy}
                  disabled={emailLoading}
                  className="text-xs px-3 py-2 rounded-xl border border-brand/30 text-brand bg-brand/5 hover:bg-brand/10 transition-colors flex-1 disabled:opacity-50"
                  title="Resend the confirmation email to the participant"
                >
                  {emailLoading ? 'Sending…' : emailSent ? 'Sent ✓' : '✉ Email copy'}
                </button>
              ) : (
                <button disabled className="text-xs px-3 py-2 rounded-xl border border-black/20 text-gray-400 flex-1 cursor-not-allowed"
                  title="No participant email on file">
                  ✉ Email copy
                </button>
              )}
            </div>
            {pdfError && (
              <p className="text-xs text-red-500 text-center">{pdfError}</p>
            )}
            {emailError && (
              <p className="text-xs text-red-500 text-center">{emailError}</p>
            )}
            {!row.pdf_path && !pdfError && (() => {
              // Fallback source: if waivers.seal_error itself failed to
              // write (the thing we're actively trying to diagnose),
              // the same message may still have made it into
              // audit_events via document.seal_failed, since that
              // table's insert policy isn't role-gated the way
              // waivers' update policies are.
              const sealFailedEvent = auditEvents
                .filter(e => e.eventType === 'document.seal_failed')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              const fallbackError = sealFailedEvent?.metadata?.error as string | undefined
              const displayError = row.seal_error ?? fallbackError ?? null

              return (
                <div className="text-xs text-gray-400 text-center">
                  <p>
                    {row.redacted_at
                      ? `Redacted on ${new Date(row.redacted_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} per the 90-day retention policy.`
                      : row.signed_at
                      ? 'Document sealing failed for this waiver — the signature itself is valid and on file, but no PDF was generated.'
                      : 'Waiver not yet signed.'}
                  </p>
                  {row.signed_at && !row.redacted_at && displayError && (
                    <p className="mt-1 font-mono bg-red-50 text-red-600 rounded-lg px-2 py-1.5 text-left break-words">
                      {displayError}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
