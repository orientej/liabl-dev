'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchEngineData, type EngineData, type ActivityRecord, type QuestionRecord } from '@/lib/document-engine'
import {
  createActivity, updateActivity, setActivityPublished, deleteActivity, saveActivityHazardClause,
  createQuestion, updateQuestion, deleteQuestion, type ClauseInput,
} from '@/lib/activity-admin'
import { getActivityIcon } from '@/components/activity-icon'

const ICON_OPTIONS = ['kayak', 'hike', 'atv', 'climb', 'generic']
const COLOR_PRESETS = ['#4B2ACF', '#15803D', '#EA580C', '#0891B2', '#DC2626', '#854F0B']

interface HazardClause { id: string; title: string; bodyTemplate: string; required: boolean; highlight: boolean }

export default function TemplateTab() {
  const [engineData, setEngineData] = useState<EngineData | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [loadError,   setLoadError]  = useState<string | null>(null)
  const [selectedId,  setSelectedId] = useState<string | null>(null)
  const [creatingActivity, setCreatingActivity] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy,        setBusy]        = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { createClient } = await import('@/lib/supabase')
      // includeUnpublished: true — this is the authoring view, operators
      // need to see and edit draft activities, not just live ones.
      const data = await fetchEngineData(createClient(), undefined, { includeUnpublished: true })
      setEngineData(data)
      setSelectedId(prev => prev ?? data.activities[0]?.id ?? null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const activities = engineData?.activities ?? []
  const selected    = activities.find(a => a.id === selectedId) ?? null

  const globalQuestions = (engineData?.questions ?? []).filter(q => q.activityId === null)
  const activityQuestions = selected
    ? (engineData?.questions ?? []).filter(q => q.activityId === selected.id)
    : []

  function clauseFor(questionId: string): { id: string; title: string; bodyTemplate: string; required: boolean; highlight: boolean } | null {
    const c = (engineData?.clauses ?? []).find(c => c.questionId === questionId)
    return c ? { id: c.id, title: c.title, bodyTemplate: c.bodyTemplate, required: c.required, highlight: c.highlight } : null
  }

  const hazardClause: HazardClause | null = selected
    ? (() => {
        const c = (engineData?.clauses ?? []).find(c => c.activityId === selected.id && c.questionId === null)
        return c ? { id: c.id, title: c.title, bodyTemplate: c.bodyTemplate, required: c.required, highlight: c.highlight } : null
      })()
    : null

  if (loading) {
    return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading activity templates…</div>
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <div className="font-semibold mb-0.5">Couldn&apos;t load activities</div>
        <div className="text-xs">{loadError}</div>
        <button onClick={refresh} className="text-xs underline mt-1">Try again</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl mb-1" style={{letterSpacing:'-0.01em'}}>Activity Template Builder</h1>
          <p className="text-sm text-gray-400">Configure activities and their adaptive question sets. Questions marked ⚡ trigger additional waiver clauses.</p>
        </div>
        <button onClick={() => setCreatingActivity(true)}
          className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90 transition-colors shrink-0">
          + New activity
        </button>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-red-400 hover:text-red-700">×</button>
        </div>
      )}

      {creatingActivity && (
        <NewActivityForm
          operatorId={engineData!.operatorId}
          nextSortOrder={activities.length}
          onCancel={() => setCreatingActivity(false)}
          onCreated={async (id) => { setCreatingActivity(false); await refresh(); setSelectedId(id) }}
          onError={setActionError}
        />
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        {activities.map(a => {
          const Icon = getActivityIcon(a.icon)
          return (
            <button key={a.id} onClick={() => setSelectedId(a.id)} className={`text-center p-4 rounded-xl border transition-all ${selectedId === a.id ? 'border-brand bg-brand/5' : 'bg-white border-black/10 hover:border-brand/30'}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto" style={{background:a.accentColor}}>
                <Icon size={20} color="#FFFFFF"/>
              </div>
              <div className="text-xs font-semibold text-ink leading-snug">{a.displayName}</div>
              <div className="mt-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.published?'bg-success-light text-success-deep':'bg-amber-50 text-amber-700'}`}>{a.published?'Live':'Draft'}</span></div>
            </button>
          )
        })}
        {activities.length === 0 && !creatingActivity && (
          <div className="col-span-3 text-center text-sm text-gray-400 py-6">No activities yet. Click &quot;+ New activity&quot; to create one.</div>
        )}
      </div>

      {selected && (
        <div className="space-y-4">
          <ActivityEditor
            activity={selected}
            onSaved={refresh}
            onDeleted={async () => { setSelectedId(null); await refresh() }}
            onBusy={setBusy}
            onError={setActionError}
            busy={busy}
          />

          <HazardClauseEditor
            operatorId={engineData!.operatorId}
            activity={selected}
            clause={hazardClause}
            onSaved={refresh}
            onError={setActionError}
          />

          <QuestionsPanel
            title="This activity's questions"
            hint="Only shown to participants doing this activity."
            operatorId={engineData!.operatorId}
            activityId={selected.id}
            questions={activityQuestions}
            clauseFor={clauseFor}
            onChanged={refresh}
            onError={setActionError}
          />

          <QuestionsPanel
            title="Global health questions"
            hint="Applies to every activity for this operator — editing here affects all activities."
            operatorId={engineData!.operatorId}
            activityId={null}
            questions={globalQuestions}
            clauseFor={clauseFor}
            onChanged={refresh}
            onError={setActionError}
          />
        </div>
      )}
    </div>
  )
}

// ── New activity form ────────────────────────────────────────────
function NewActivityForm({ operatorId, nextSortOrder, onCancel, onCreated, onError }: {
  operatorId: string; nextSortOrder: number
  onCancel: () => void; onCreated: (id: string) => void; onError: (e: string) => void
}) {
  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [icon, setIcon] = useState('generic')
  const [color, setColor] = useState(COLOR_PRESETS[0])
  const [baseRisk, setBaseRisk] = useState(20)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!key.trim() || !displayName.trim()) return
    setSubmitting(true)
    try {
      const id = await createActivity({
        operatorId,
        key: key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        displayName: displayName.trim(),
        subtitle: subtitle.trim() || null,
        icon, accentColor: color, baseRiskScore: baseRisk,
        sortOrder: nextSortOrder,
      })
      onCreated(id)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create activity')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-5 mb-6">
      <h3 className="font-semibold text-sm text-ink mb-4">New activity</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Display name</label>
          <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Zip Lining" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Key (used internally, lowercase)</label>
          <input className="form-input" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. zipline" />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Subtitle (shown to participants)</label>
        <input className="form-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. 800ft dual-line canopy tour" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Icon</label>
          <select className="form-input" value={icon} onChange={e => setIcon(e.target.value)}>
            {ICON_OPTIONS.map(o => <option key={o} value={o}>{o === 'generic' ? 'Generic' : o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Color</label>
          <div className="flex gap-1.5 items-center h-9">
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 ${color===c?'border-ink':'border-transparent'}`} style={{background:c}} />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Base risk score (0–100)</label>
          <input type="number" min={0} max={100} className="form-input" value={baseRisk} onChange={e => setBaseRisk(Number(e.target.value))} />
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-3">
        New activities are created as drafts. Add a hazard clause and publish when ready — participants never see drafts.
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-2">Cancel</button>
        <button onClick={submit} disabled={!key.trim() || !displayName.trim() || submitting} className="btn-primary py-2">
          {submitting ? 'Creating…' : 'Create activity'}
        </button>
      </div>
    </div>
  )
}

// ── Activity editor (name/subtitle/icon/color/risk + publish/delete) ─────
function ActivityEditor({ activity, onSaved, onDeleted, onBusy, onError, busy }: {
  activity: ActivityRecord
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
  onBusy: (b: boolean) => void
  onError: (e: string) => void
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(activity.displayName)
  const [subtitle, setSubtitle] = useState(activity.subtitle ?? '')
  const [icon, setIcon] = useState(activity.icon)
  const [color, setColor] = useState(activity.accentColor)
  const [baseRisk, setBaseRisk] = useState(activity.baseRiskScore)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setDisplayName(activity.displayName); setSubtitle(activity.subtitle ?? '')
    setIcon(activity.icon); setColor(activity.accentColor); setBaseRisk(activity.baseRiskScore)
    setEditing(false); setConfirmDelete(false)
  }, [activity.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const Icon = getActivityIcon(icon)

  async function save() {
    onBusy(true)
    try {
      await updateActivity(activity.id, { displayName: displayName.trim(), subtitle: subtitle.trim() || null, icon, accentColor: color, baseRiskScore: baseRisk })
      await onSaved()
      setEditing(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save activity')
    } finally {
      onBusy(false)
    }
  }

  async function togglePublished() {
    onBusy(true)
    try {
      await setActivityPublished(activity.id, !activity.published)
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update publish state')
    } finally {
      onBusy(false)
    }
  }

  async function confirmedDelete() {
    onBusy(true)
    try {
      await deleteActivity(activity.id)
      await onDeleted()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete activity')
      onBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:color}}>
            <Icon size={20} color="#FFFFFF"/>
          </div>
          {!editing ? (
            <div>
              <div className="font-semibold text-ink">{activity.displayName}</div>
              <div className="text-xs text-gray-400">{activity.subtitle ?? 'No subtitle'} · Base risk {activity.baseRiskScore}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Editing…</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${activity.published?'bg-success-light text-success-deep':'bg-amber-50 text-amber-700'}`}>{activity.published ? 'Published' : 'Draft'}</span>
          {!editing && <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface">Edit</button>}
        </div>
      </div>

      {editing && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display name</label>
              <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subtitle</label>
              <input className="form-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Icon</label>
              <select className="form-input" value={icon} onChange={e => setIcon(e.target.value)}>
                {ICON_OPTIONS.map(o => <option key={o} value={o}>{o === 'generic' ? 'Generic' : o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <div className="flex gap-1.5 items-center h-9">
                {COLOR_PRESETS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 ${color===c?'border-ink':'border-transparent'}`} style={{background:c}} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base risk score</label>
              <input type="number" min={0} max={100} className="form-input" value={baseRisk} onChange={e => setBaseRisk(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary py-2 text-sm">Cancel</button>
            <button onClick={save} disabled={busy || !displayName.trim()} className="btn-primary py-2 text-sm">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-black/8">
        <button onClick={togglePublished} disabled={busy} className="text-xs px-3 py-2 rounded-xl border border-black/20 text-gray-600 hover:bg-surface disabled:opacity-40">
          {activity.published ? 'Unpublish (keep as draft)' : 'Publish (make live)'}
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} disabled={busy} className="text-xs px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40">
            Delete activity
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-700">Delete permanently? Questions &amp; clauses for this activity go too.</span>
            <button onClick={confirmedDelete} disabled={busy} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg border border-black/10">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hazard clause editor (the one required, unconditional per-activity clause) ─
function HazardClauseEditor({ operatorId, activity, clause, onSaved, onError }: {
  operatorId: string; activity: ActivityRecord; clause: HazardClause | null
  onSaved: () => Promise<void>; onError: (e: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(clause?.title ?? `${activity.displayName} Hazard Acknowledgment`)
  const [body, setBody] = useState(clause?.bodyTemplate ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(clause?.title ?? `${activity.displayName} Hazard Acknowledgment`)
    setBody(clause?.bodyTemplate ?? '')
    setEditing(false)
  }, [activity.id, clause?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!body.trim()) return
    setSaving(true)
    try {
      await saveActivityHazardClause(
        operatorId, activity.id, `${activity.key}_hazard`,
        { title: title.trim(), bodyTemplate: body.trim(), required: true, highlight: true },
        clause?.id ?? null
      )
      await onSaved()
      setEditing(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save hazard clause')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hazard clause · always included for this activity</div>
        {!editing && <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface">{clause ? 'Edit' : 'Add clause'}</button>}
      </div>

      {!editing ? (
        clause ? (
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
            <div className="text-xs font-semibold text-brand mb-1">⚡ {clause.title}</div>
            <p className="text-xs text-gray-600 leading-relaxed">{clause.bodyTemplate}</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            No hazard clause yet — this activity can&apos;t safely go live without one. Click &quot;Add clause&quot; above.
          </div>
        )
      ) : (
        <div>
          <div className="mb-2">
            <label className="block text-xs text-gray-500 mb-1">Clause title</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="mb-2">
            <label className="block text-xs text-gray-500 mb-1">Clause text</label>
            <textarea className="form-input resize-none" rows={4} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Describe the specific hazards of this activity and what the participant is acknowledging…" />
            <div className="text-xs text-gray-400 mt-1">Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{activity}}'}</code>, <code>{'{{date}}'}</code></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary py-2 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !body.trim()} className="btn-primary py-2 text-sm">{saving ? 'Saving…' : 'Save clause'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Questions panel (used for both per-activity and global questions) ────
function QuestionsPanel({ title, hint, operatorId, activityId, questions, clauseFor, onChanged, onError }: {
  title: string; hint: string
  operatorId: string; activityId: string | null
  questions: QuestionRecord[]
  clauseFor: (questionId: string) => { id: string; title: string; bodyTemplate: string; required: boolean; highlight: boolean } | null
  onChanged: () => Promise<void>
  onError: (e: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="text-xs text-gray-400">{hint}</div>
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface shrink-0">+ Add question</button>}
      </div>

      {adding && (
        <QuestionForm
          operatorId={operatorId} activityId={activityId} sortOrder={questions.length}
          onCancel={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await onChanged() }}
          onError={onError}
        />
      )}

      <div className="space-y-2 mt-3">
        {questions.map((q, i) => {
          const clause = clauseFor(q.id)
          return editingId === q.id ? (
            <QuestionForm
              key={q.id}
              operatorId={operatorId} activityId={activityId} sortOrder={q.sortOrder}
              existing={q} existingClause={clause}
              onCancel={() => setEditingId(null)}
              onSaved={async () => { setEditingId(null); await onChanged() }}
              onError={onError}
            />
          ) : (
            <div key={q.id} className="bg-surface rounded-xl border border-black/8 p-3 flex items-start gap-3">
              <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5">{(i+1).toString().padStart(2,'0')}</span>
              <div className="flex-1">
                <div className="text-sm text-ink">{q.text}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Type: {q.type === 'yes_no' ? 'Yes/No' : q.type === 'multiple' ? 'Multiple choice' : 'Free text'}
                  {q.triggersClause && clause && <> · Clause: &quot;{clause.title}&quot;</>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {q.triggersClause && (
                  <span className="text-xs bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full font-medium">⚡ Adaptive</span>
                )}
                <button onClick={() => setEditingId(q.id)} className="text-xs text-gray-400 hover:text-ink underline">Edit</button>
                <DeleteQuestionButton questionId={q.id} onDeleted={onChanged} onError={onError} />
              </div>
            </div>
          )
        })}
        {questions.length === 0 && !adding && (
          <div className="text-xs text-gray-400 py-3 text-center">No questions yet.</div>
        )}
      </div>
    </div>
  )
}

function DeleteQuestionButton({ questionId, onDeleted, onError }: { questionId: string; onDeleted: () => Promise<void>; onError: (e: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmedDelete() {
    setBusy(true)
    try {
      await deleteQuestion(questionId)
      await onDeleted()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete question')
      setBusy(false)
    }
  }

  if (!confirming) return <button onClick={() => setConfirming(true)} className="text-xs text-red-500 hover:text-red-700 underline">Delete</button>
  return (
    <span className="flex items-center gap-1 text-xs">
      <button onClick={confirmedDelete} disabled={busy} className="text-red-700 font-medium underline">Confirm</button>
      <button onClick={() => setConfirming(false)} className="text-gray-400 underline">Cancel</button>
    </span>
  )
}

// ── Add/edit question form (used inline, both for new and existing) ──────
function QuestionForm({ operatorId, activityId, sortOrder, existing, existingClause, onCancel, onSaved, onError }: {
  operatorId: string; activityId: string | null; sortOrder: number
  existing?: QuestionRecord
  existingClause?: { id: string; title: string; bodyTemplate: string; required: boolean; highlight: boolean } | null
  onCancel: () => void
  onSaved: () => Promise<void>
  onError: (e: string) => void
}) {
  const [text, setText] = useState(existing?.text ?? '')
  const [type, setType] = useState<'yes_no'|'text'|'multiple'>(existing?.type ?? 'yes_no')
  const [triggersClause, setTriggersClause] = useState(existing?.triggersClause ?? false)
  const [triggerValue, setTriggerValue] = useState(existing?.triggerValue ?? 'yes')
  const [clauseTitle, setClauseTitle] = useState(existingClause?.title ?? '')
  const [clauseBody, setClauseBody] = useState(existingClause?.bodyTemplate ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!text.trim()) return
    if (triggersClause && !clauseBody.trim()) return
    setSubmitting(true)

    const clause: ClauseInput | null = triggersClause
      ? { title: clauseTitle.trim() || 'Additional Disclosure', bodyTemplate: clauseBody.trim(), required: true, highlight: true }
      : null

    try {
      if (existing) {
        await updateQuestion(
          existing.id,
          { text: text.trim(), type, triggersClause, triggerValue, clause },
          existingClause?.id ?? null,
          operatorId
        )
      } else {
        await createQuestion({
          operatorId, activityId, text: text.trim(), type, triggersClause, triggerValue, sortOrder, clause,
        })
      }
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save question')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-brand/20 p-4 mb-2">
      <div className="mb-2">
        <label className="block text-xs text-gray-500 mb-1">Question text</label>
        <input className="form-input" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Do you have any heart conditions?" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Answer type</label>
          <select className="form-input" value={type} onChange={e => setType(e.target.value as typeof type)}>
            <option value="yes_no">Yes / No</option>
            <option value="multiple">Multiple choice</option>
            <option value="text">Free text</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={triggersClause} onChange={e => setTriggersClause(e.target.checked)} />
            ⚡ This question can trigger an extra clause
          </label>
        </div>
      </div>

      {triggersClause && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 mb-2">
          <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Clause added when answered &quot;{type === 'yes_no' ? 'Yes' : triggerValue}&quot;</div>
          {type !== 'yes_no' && (
            <div className="mb-2">
              <label className="block text-xs text-gray-500 mb-1">Triggering answer value</label>
              <input className="form-input" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} placeholder="Exact answer value that triggers the clause" />
            </div>
          )}
          <div className="mb-2">
            <label className="block text-xs text-gray-500 mb-1">Clause title</label>
            <input className="form-input" value={clauseTitle} onChange={e => setClauseTitle(e.target.value)} placeholder="e.g. Physician Clearance — Cardiac Condition" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Clause text</label>
            <textarea className="form-input resize-none" rows={3} value={clauseBody} onChange={e => setClauseBody(e.target.value)}
              placeholder="What the participant is acknowledging or confirming…" />
            <div className="text-xs text-gray-400 mt-1">Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{activity}}'}</code>, <code>{'{{date}}'}</code></div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-2 text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting || !text.trim() || (triggersClause && !clauseBody.trim())} className="btn-primary py-2 text-sm">
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Add question'}
        </button>
      </div>
    </div>
  )
}
