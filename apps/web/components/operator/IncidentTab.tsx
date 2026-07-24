'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  listIncidents, createIncident, markCarrierNotified, updateIncidentStatus,
  searchWaiversByParticipant,
  type IncidentRecord, type IncidentSeverity, type IncidentStatus, type WaiverSearchResult,
} from '@/lib/incidents'
import { fetchEngineData, activityLabel, type ActivityRecord } from '@/lib/document-engine'

const SEV_STYLES: Record<string, string> = {
  minor:    'bg-blue-50 text-blue-700 border-blue-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  serious:  'bg-red-50 text-red-700 border-red-200',
}
const STATUS_STYLES: Record<IncidentStatus, string> = {
  open:          'bg-gray-100 text-gray-600',
  notified:      'bg-amber-50 text-amber-700',
  investigating: 'bg-blue-50 text-blue-700',
  closed:        'bg-emerald-50 text-emerald-700',
}
const STATUS_LABELS: Record<IncidentStatus, string> = {
  open:'Open', notified:'Carrier notified', investigating:'Under investigation', closed:'Closed',
}
// Activity labels now come from the activities table (fetched below) via
// the shared activityLabel() helper, instead of a hardcoded map here.

export default function IncidentTab() {
  const [incidents,  setIncidents]  = useState<IncidentRecord[]>([])
  const [loading,     setLoading]    = useState(true)
  const [loadError,   setLoadError]  = useState<string | null>(null)
  const [selected,    setSelected]   = useState<IncidentRecord | null>(null)
  const [creating,    setCreating]   = useState(false)
  const [activities,  setActivities] = useState<ActivityRecord[]>([])
  const [operatorId,  setOperatorId] = useState<string | null>(null)

  useEffect(() => {
    refresh()
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase')
        const engineData = await fetchEngineData(createClient())
        setActivities(engineData.activities)
        setOperatorId(engineData.operatorId)
      } catch (e) {
        console.error('[IncidentTab] activities load failed:', e)
      }
    })()
  }, [])

  async function refresh() {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = await listIncidents()
      setIncidents(rows)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(incident: IncidentRecord) {
    setIncidents(i => [incident, ...i])
    setCreating(false)
  }

  function handleUpdated(updated: IncidentRecord) {
    setIncidents(i => i.map(x => x.id === updated.id ? updated : x))
    if (selected?.id === updated.id) setSelected(updated)
  }

  if (selected) {
    return (
      <IncidentDetail
        incident={selected}
        activities={activities}
        onBack={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Incident reports</h1>
          <p className="text-sm text-gray-400 mt-1">Desert Ridge Adventures · All incidents</p>
        </div>
        <button onClick={() => setCreating(!creating)}
          className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90 transition-colors">
          + File incident report
        </button>
      </div>

      {creating && (
        <CreateIncidentForm
          activities={activities}
          operatorId={operatorId}
          onCancel={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700 flex items-start gap-2">
          <span>⚠️</span>
          <div>
            <div className="font-semibold mb-0.5">Couldn&apos;t load incidents</div>
            <div className="text-xs">{loadError}</div>
            <button onClick={refresh} className="text-xs underline mt-1">Try again</button>
          </div>
        </div>
      )}

      {/* Stats — computed from real loaded incidents, not fabricated */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label:'Total incidents', value:incidents.length,                                                    color:'' },
          { label:'Carrier notified',value:incidents.filter(i=>i.status==='notified'||i.status==='investigating'||i.status==='closed').length, color:'text-amber-600' },
          { label:'Investigating',   value:incidents.filter(i=>i.status==='investigating').length,              color:'text-blue-600' },
          { label:'Closed',          value:incidents.filter(i=>i.status==='closed').length,                     color:'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-black/10 p-4">
            <div className={`text-2xl font-semibold mb-1 ${color||'text-ink'}`} style={{ letterSpacing:'-0.02em' }}>{value}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Loading incidents…</div>
        ) : incidents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No incidents filed yet.</div>
        ) : (
          incidents.map(inc => (
            <div key={inc.id} onClick={() => setSelected(inc)}
              className="flex items-center gap-3 px-5 py-4 border-b border-black/5 last:border-0 hover:bg-surface/60 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-ink">{inc.participantName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEV_STYLES[inc.severity]}`}>{inc.severity}</span>
                  {!inc.waiverId && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 font-medium">No linked waiver</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {inc.activity ? activityLabel(activities, inc.activity) : '—'} · {new Date(inc.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} · {inc.ref}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[inc.status]}`}>{STATUS_LABELS[inc.status]}</span>
                <span className="text-gray-300">→</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Create form, with waiver search-or-free-text ──────────────────
function CreateIncidentForm({ activities, operatorId, onCancel, onCreated }: { activities: ActivityRecord[]; operatorId: string | null; onCancel: () => void; onCreated: (i: IncidentRecord) => void }) {
  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WaiverSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [linkedWaiver, setLinkedWaiver] = useState<WaiverSearchResult | null>(null)

  const [form, setForm] = useState({ participantName: '', activity: activities[0]?.key ?? '', severity: 'minor' as IncidentSeverity, description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<IncidentRecord | null>(null)

  // If activities load in after this form is already open, backfill the
  // default so the select isn't stuck on an empty value.
  useEffect(() => {
    if (!form.activity && activities.length > 0) {
      setForm(f => ({ ...f, activity: activities[0].key }))
    }
  }, [activities]) // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(async (q: string) => {
    setQuery(q)
    setLinkedWaiver(null)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const rows = await searchWaiversByParticipant(q)
    setResults(rows)
    setSearching(false)
  }, [])

  function selectWaiver(w: WaiverSearchResult) {
    setLinkedWaiver(w)
    setResults([])
    setForm(f => ({ ...f, participantName: w.participantName, activity: w.activityKey }))
  }

  const effectiveName = mode === 'search' && linkedWaiver ? linkedWaiver.participantName : form.participantName

  async function submit() {
    if (!effectiveName.trim() || !form.description.trim()) return
    if (!operatorId) { setSubmitError('Still loading your organization — try again in a moment.'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const incident = await createIncident({
        operatorId,
        waiverId: mode === 'search' ? (linkedWaiver?.waiverId ?? null) : null,
        participantName: effectiveName.trim(),
        activity: form.activity,
        severity: form.severity,
        description: form.description.trim(),
      })
      setSubmitted(incident)
      setTimeout(() => onCreated(incident), 1200)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to file incident')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-5 mb-6 animate-fade-up">
      <h3 className="font-semibold text-sm text-ink mb-4">New incident report</h3>

      {submitted ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">✅</div>
          <div className="font-medium text-ink">Incident {submitted.ref} filed{submitted.waiverId ? ' — legal hold applied to the linked waiver' : ''}</div>
          {!submitted.waiverId && (
            <div className="text-xs text-gray-400 mt-1">No waiver was linked, so no legal hold was applied. Link one later from the incident detail view if found.</div>
          )}
          <div className="text-xs text-amber-700 mt-2">Carrier has not been notified yet — do that from the incident detail view once you&apos;ve made contact.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Participant: search existing waiver, or fall back to free text */}
          <div>
            <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit mb-2">
              {(['search', 'manual'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setLinkedWaiver(null); setQuery(''); setResults([]) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${mode===m?'bg-white text-ink shadow-sm':'text-gray-500'}`}>
                  {m === 'search' ? 'Find signed waiver' : 'Enter name manually'}
                </button>
              ))}
            </div>

            {mode === 'search' ? (
              linkedWaiver ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <div className="text-sm text-emerald-800">
                    <span className="font-medium">{linkedWaiver.participantName}</span>
                    <span className="text-xs text-emerald-600 ml-2">{activityLabel(activities, linkedWaiver.activityKey)}</span>
                  </div>
                  <button onClick={() => setLinkedWaiver(null)} className="text-xs text-emerald-700 underline">Change</button>
                </div>
              ) : (
                <div>
                  <input className="form-input" value={query} onChange={e => runSearch(e.target.value)} placeholder="Search participant name…" />
                  {searching && <div className="text-xs text-gray-400 mt-1">Searching…</div>}
                  {results.length > 0 && (
                    <div className="mt-1 bg-white border border-black/10 rounded-xl overflow-hidden">
                      {results.map(r => (
                        <button key={r.waiverId} onClick={() => selectWaiver(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface border-b border-black/5 last:border-0">
                          <span className="font-medium text-ink">{r.participantName}</span>
                          <span className="text-xs text-gray-400 ml-2">{activityLabel(activities, r.activityKey)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {query.trim().length >= 2 && !searching && results.length === 0 && (
                    <div className="text-xs text-gray-400 mt-1">No matching signed waivers. Try &quot;Enter name manually&quot; if this participant hasn&apos;t signed yet.</div>
                  )}
                </div>
              )
            ) : (
              <input className="form-input" value={form.participantName}
                onChange={e => setForm(f => ({...f, participantName:e.target.value}))} placeholder="Full name" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Activity</label>
              <select className="form-input" value={form.activity} disabled={mode==='search' && !!linkedWaiver}
                onChange={e => setForm(f => ({...f, activity:e.target.value}))}>
                {activities.map(a => <option key={a.key} value={a.key}>{a.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Severity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['minor','moderate','serious'] as const).map(s => (
                  <button key={s} onClick={() => setForm(f => ({...f, severity:s}))}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all capitalize ${form.severity===s?SEV_STYLES[s]:'border-black/10 bg-surface text-gray-500'}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea className="form-input resize-none" rows={3} value={form.description}
              onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Describe what happened, injuries reported, actions taken…" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            ⚡ Filing this report will apply a legal hold to the linked waiver, if one is selected. Carrier notification is a separate step you log manually once you&apos;ve actually contacted them.
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{submitError}</div>
          )}

          <div className="flex gap-2">
            <button onClick={onCancel} className="btn-secondary py-2">Cancel</button>
            <button onClick={submit} disabled={!effectiveName.trim() || !form.description.trim() || submitting} className="btn-primary py-2">
              {submitting ? 'Filing…' : 'File incident report'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detail view ─────────────────────────────────────────────────
function IncidentDetail({ incident, activities, onBack, onUpdated }: { incident: IncidentRecord; activities: ActivityRecord[]; onBack: () => void; onUpdated: (i: IncidentRecord) => void }) {
  const [notifying, setNotifying] = useState(false)
  const [notifiedBy, setNotifiedBy] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirmNotify() {
    if (!notifiedBy.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await markCarrierNotified(incident.id, notifiedBy.trim())
      onUpdated(updated)
      setNotifying(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to record notification')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(status: IncidentRecord['status']) {
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateIncidentStatus(incident.id, status)
      onUpdated(updated)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-ink mb-4">← All incidents</button>

      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="font-mono text-xs text-gray-400 mb-1">{incident.ref}</div>
            <h2 className="font-serif text-xl" style={{ letterSpacing:'-0.01em' }}>{incident.participantName}</h2>
            <div className="text-sm text-gray-400">{incident.activity ? activityLabel(activities, incident.activity) : '—'} · {new Date(incident.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${SEV_STYLES[incident.severity]}`}>
              {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[incident.status]}`}>
              {STATUS_LABELS[incident.status]}
            </span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 mb-4 space-y-2 text-xs">
          {[
            { l:'Linked waiver', v: incident.waiverId ? `${incident.waiverId.slice(0,8)}…` : 'None linked' },
            { l:'Legal hold',    v: incident.waiverId ? 'Applied to linked waiver' : 'Not applicable — no linked waiver' },
            { l:'Carrier',       v: incident.carrierNotifiedAt ? `Notified by ${incident.notifiedBy ?? 'unknown'}` : 'Not yet notified' },
            { l:'Notified at',   v: incident.carrierNotifiedAt ? new Date(incident.carrierNotifiedAt).toLocaleString() : '—' },
          ].map(({ l, v }) => (
            <div key={l} className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">{l}</span><span className="font-medium text-ink font-mono">{v}</span></div>
          ))}
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Incident description</div>
          <p className="text-sm text-gray-600 leading-relaxed bg-surface rounded-xl p-4">{incident.description}</p>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 mb-4">{actionError}</div>
        )}

        {/* Carrier notification — real, manual, attributable */}
        {!incident.carrierNotifiedAt && (
          notifying ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-900 mb-2">Confirm carrier notification</div>
              <p className="text-xs text-amber-700 mb-3">Only confirm this once you&apos;ve actually contacted the carrier (phone, email, or portal). This is logged with your name and a timestamp.</p>
              <input className="form-input mb-2" placeholder="Your name" value={notifiedBy} onChange={e => setNotifiedBy(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setNotifying(false)} className="btn-secondary py-2 text-xs">Cancel</button>
                <button onClick={confirmNotify} disabled={!notifiedBy.trim() || busy} className="btn-primary py-2 text-xs">
                  {busy ? 'Saving…' : 'Confirm — carrier has been notified'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNotifying(true)} className="text-sm px-4 py-2 border border-amber-300 text-amber-700 rounded-xl font-medium hover:bg-amber-50">
              Mark carrier notified…
            </button>
          )
        )}

        {/* Status controls */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['investigating', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)} disabled={busy || incident.status === s}
              className="text-xs px-3 py-2 rounded-xl border border-black/20 text-gray-600 hover:bg-surface disabled:opacity-40 transition-colors capitalize">
              Mark {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
