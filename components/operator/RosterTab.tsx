'use client'
import { useState, useEffect, useMemo } from 'react'
import { calculateRiskScore } from '@/components/RiskScore'
import WaiverDetail, { type WaiverDetailRow } from '@/components/operator/WaiverDetail'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { getActivityIcon } from '@/components/activity-icon'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant { full_name: string; email: string }

interface SessionInfo { session_ref: string | null; session_time: string | null }

interface WaiverRow {
  id: string
  session_id: string | null
  signed_at: string | null
  activity_key: string
  is_minor: boolean
  ip_address: string | null
  document_hash: string | null    // null until Milestone 2 hashing lands
  pdf_url: string | null           // null until Milestone 2 sealing lands
  answers: Record<string, unknown> | null
  clauses: WaiverClause[] | null
  participants: Participant | null
  sessions: SessionInfo | null
}

interface WaiverClause {
  id: string
  title: string
  body: string
  highlight?: boolean
  required: boolean
}

type Filter = 'all' | 'signed' | 'pending'

// ─── Demo fallback (shown only when Supabase returns 0 rows) ─────────────────
// Visually flagged as sample data — never silently mixed with real rows.

const DEMO: WaiverRow[] = [
  { id:'demo-1', session_id:null, signed_at:'2026-05-26T08:42:00Z', activity_key:'kayak',  is_minor:false, ip_address:null, document_hash:null, pdf_url:null, answers:null, clauses:null, participants:{ full_name:'Jordan Rivera', email:'j@email.com' }, sessions:null },
  { id:'demo-2', session_id:null, signed_at:'2026-05-26T08:51:00Z', activity_key:'hike',   is_minor:true,  ip_address:null, document_hash:null, pdf_url:null, answers:null, clauses:null, participants:{ full_name:'Mia Chen',      email:'m@email.com' }, sessions:null },
  { id:'demo-3', session_id:null, signed_at:'2026-05-26T08:53:00Z', activity_key:'atv',    is_minor:false, ip_address:null, document_hash:null, pdf_url:null, answers:null, clauses:null, participants:{ full_name:'Tyler Brooks',  email:'t@email.com' }, sessions:null },
  { id:'demo-4', session_id:null, signed_at:null,                   activity_key:'climb',  is_minor:false, ip_address:null, document_hash:null, pdf_url:null, answers:null, clauses:null, participants:{ full_name:'Sasha Kim',     email:'s@email.com' }, sessions:null },
  { id:'demo-5', session_id:null, signed_at:'2026-05-26T08:58:00Z', activity_key:'kayak',  is_minor:false, ip_address:null, document_hash:null, pdf_url:null, answers:null, clauses:null, participants:{ full_name:'Omar Hassan',   email:'o@email.com' }, sessions:null },
]

// Fallback shown only when real waivers exist but none carry session data yet
// (e.g. rows written before the sessions table was linked in).
const DEMO_SESSION_LABEL = 'AM-04 · 9:00 AM'

// ─── Display constants ────────────────────────────────────────────────────────
// Activity icon/color/label now come from the activities table
// (see lib/document-engine.ts fetchEngineData) instead of hardcoded maps.

const BG = ['#E6F1FB','#E1F5EE','#EEE9FF','#FAEEDA','#FBEAF0','#EAF3DE']
const FG = ['#185FA5','#0F6E56','#4B2ACF','#854F0B','#993556','#3B6D11']

const RISK_STYLES: Record<string, { badge:string; bar:string; label:string }> = {
  low:      { badge:'text-emerald-700 bg-emerald-50 border-emerald-200', bar:'bg-emerald-500', label:'Low Risk'      },
  moderate: { badge:'text-blue-700    bg-blue-50    border-blue-200',    bar:'bg-blue-500',    label:'Moderate Risk' },
  elevated: { badge:'text-amber-700   bg-amber-50   border-amber-200',   bar:'bg-amber-500',   label:'Elevated Risk' },
  high:     { badge:'text-red-700     bg-red-50     border-red-200',     bar:'bg-red-500',     label:'High Risk'     },
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/** Derive age in years from an ISO date string. Returns undefined if unparseable. */
function ageFromDob(dob: unknown): number | undefined {
  if (typeof dob !== 'string' || !dob) return undefined
  const ms = Date.now() - new Date(dob).getTime()
  if (isNaN(ms)) return undefined
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25))
}

// ─── RosterTab ────────────────────────────────────────────────────────────────

export default function RosterTab() {
  const [roster,       setRoster]       = useState<WaiverRow[]>(DEMO)
  const [isDemo,       setIsDemo]       = useState(true)
  const [returningIds, setReturningIds] = useState<Set<string>>(new Set())
  const [filter,       setFilter]       = useState<Filter>('all')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [sessionLabel, setSessionLabel] = useState<string>(DEMO_SESSION_LABEL)
  const [activities,   setActivities]   = useState<ActivityRecord[]>([])

  const activitiesByKey = useMemo(
    () => Object.fromEntries(activities.map(a => [a.key, a])),
    [activities]
  )

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()

        // Activities are fetched independently of the waiver rows — this
        // tab needs them for icon/color/label/base-risk regardless of
        // whether any waivers exist yet.
        try {
          const engineData = await fetchEngineData(supabase)
          setActivities(engineData.activities)
        } catch (engineErr) {
          console.error('[RosterTab] activities load failed:', engineErr)
        }

        // Pull full waiver rows including answers + clauses so WaiverDetail
        // can render real data without a second per-row fetch on expand.
        const { data } = await supabase
          .from('waivers')
          .select('id, session_id, signed_at, activity_key, is_minor, ip_address, document_hash, pdf_url, answers, clauses, participants(full_name, email), sessions(session_ref, session_time)')
          .order('created_at', { ascending: true })
          .limit(50)

        if (data && data.length > 0) {
          const rows: WaiverRow[] = data.map((row: Record<string, unknown>) => ({
            id:            row.id as string,
            session_id:    row.session_id as string | null,
            signed_at:     row.signed_at as string | null,
            activity_key:  row.activity_key as string,
            is_minor:      row.is_minor as boolean,
            ip_address:    row.ip_address as string | null,
            document_hash: row.document_hash as string | null,
            pdf_url:       row.pdf_url as string | null,
            answers:       row.answers as Record<string, unknown> | null,
            clauses:       row.clauses as WaiverClause[] | null,
            participants:  Array.isArray(row.participants)
              ? (row.participants[0] as Participant) ?? null
              : row.participants as Participant | null,
            sessions:      Array.isArray(row.sessions)
              ? (row.sessions[0] as SessionInfo) ?? null
              : row.sessions as SessionInfo | null,
          }))
          setRoster(rows)
          setIsDemo(false)

          // Single-session view for now (no session switcher yet — that's
          // separate "operator session management" scope). Use the most
          // recent row's linked session as the header. If real waivers
          // exist but none carry session data, fall back to the label
          // rather than silently showing nothing.
          const withSession = [...rows].reverse().find(r => r.sessions?.session_ref)
          setSessionLabel(
            withSession?.sessions
              ? `${withSession.sessions.session_ref}${withSession.sessions.session_time ? ' · ' + withSession.sessions.session_time : ''}`
              : DEMO_SESSION_LABEL
          )

          // Returning participant: find emails that appear in >1 signed waiver.
          // Single-operator scope — not the cross-operator LIABL Pass graph.
          const emailCounts: Record<string, number> = {}
          rows.forEach(r => {
            if (r.signed_at && r.participants?.email) {
              emailCounts[r.participants.email] = (emailCounts[r.participants.email] ?? 0) + 1
            }
          })
          const returningEmails = new Set(Object.keys(emailCounts).filter(e => emailCounts[e] > 1))
          setReturningIds(new Set(rows.filter(r => returningEmails.has(r.participants?.email ?? '')).map(r => r.id)))
        }
      } catch (e) {
        console.error('[RosterTab] load failed, showing demo data:', e)
        // Demo fallback intentionally stays — isDemo remains true so the
        // banner is shown and nobody mistakes sample data for real participants.
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const visible = roster.filter(w =>
    filter === 'signed'  ? !!w.signed_at :
    filter === 'pending' ? !w.signed_at  : true
  )
  const signed  = roster.filter(w => !!w.signed_at).length
  const pending = roster.filter(w => !w.signed_at).length
  const pct     = Math.round(signed / Math.max(roster.length, 1) * 100)

  function toggleExpand(id: string, isSigned: boolean) {
    if (!isSigned) return
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Check-in Roster</h1>
          <p className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</p>
        </div>
        <span className="bg-brand/10 text-brand border border-brand/20 text-xs font-medium px-3 py-1.5 rounded-full">{sessionLabel}</span>
      </div>

      {/* Demo-data banner — shown whenever real data couldn't be loaded */}
      {isDemo && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-2 text-sm text-amber-800">
          <span className="shrink-0 mt-0.5">⚠</span>
          <div>
            <span className="font-semibold">Showing sample data</span> — no signed waivers found in the database yet. Participants who complete the signing flow will appear here automatically.
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-black/10 px-4 py-3 mb-5 text-sm text-gray-400">Loading roster…</div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label:'Signed',   value: signed,   color:'text-emerald-600' },
          { label:'Pending',  value: pending,  color:'text-amber-600'   },
          { label:'Complete', value:`${pct}%`, color:'text-brand'       },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-black/10 p-4">
            <div className={`text-2xl font-semibold ${color}`} style={{ letterSpacing:'-0.02em' }}>{value}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="w-full h-1.5 bg-black/8 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width:`${pct}%` }} />
      </div>

      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Participants</span>
            <span className="text-xs text-gray-400 hidden sm:block">· Click a signed row to expand waiver detail &amp; AI risk</span>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'signed', 'pending'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === f ? 'bg-brand text-white' : 'bg-surface text-gray-500 hover:bg-black/5'
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {visible.map((w, i) => {
          const name     = w.participants?.full_name ?? 'Unknown'
          const time     = w.signed_at ? new Date(w.signed_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'
          const isRet    = returningIds.has(w.id)
          const isSigned = !!w.signed_at
          const isOpen   = expanded === w.id
          const activity = activitiesByKey[w.activity_key]
          const Icon     = activity ? getActivityIcon(activity.icon) : null

          // Risk score on the roster row — still needs full factors from answers
          const answers  = w.answers ?? {}
          const risk     = calculateRiskScore({
            activityKey:      w.activity_key,
            activityBaseRisk: activity?.baseRiskScore,
            isMinor:          w.is_minor,
            healthStatus:     answers.healthStatus as string | string[] | undefined,
            age:              ageFromDob(answers.dob),
          })
          const rs = RISK_STYLES[risk.level]

          return (
            <div key={w.id}>
              <div
                onClick={() => toggleExpand(w.id, isSigned)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-black/5 transition-colors ${
                  isSigned ? 'hover:bg-brand/5 cursor-pointer' : 'opacity-60'
                } ${isOpen ? 'bg-brand/5 border-b-0' : ''}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: BG[i % BG.length], color: FG[i % FG.length] }}>
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{name}</span>
                    {isRet && <span className="text-xs bg-brand/10 text-brand px-1.5 py-0.5 rounded-full shrink-0">↩ Returning</span>}
                    {isDemo && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full shrink-0">Sample</span>}
                  </div>
                  <div className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                    {Icon && activity && <Icon size={12} color={activity.accentColor} />}
                    {activity?.displayName ?? w.activity_key} · {time}
                  </div>
                </div>

                {isSigned && (
                  <div className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${rs.badge}`}>
                    <span>⚡</span>
                    <span className="hidden sm:inline">Risk · </span>
                    <span>{risk.score}</span>
                  </div>
                )}

                {w.is_minor
                  ? <span className="status-guardian shrink-0">Guardian</span>
                  : w.signed_at
                  ? <span className="status-signed shrink-0 flex items-center gap-1">Signed {isOpen ? '▲' : '▼'}</span>
                  : <span className="status-pending shrink-0">Pending</span>}
              </div>

              {isOpen && (
                <WaiverDetail row={w} index={i} isDemo={isDemo} activities={activities} onClose={() => setExpanded(null)} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
