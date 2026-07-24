'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  publishTemplateVersion, listTemplateVersions, signatureCountsByVersion,
  fetchActivityVersionState,
  type TemplateVersion, type ActivityVersionState, type SnapshotClause, type SnapshotQuestion,
} from '@/lib/template-versions'

// Self-contained versioning UI for one activity/template. Dropped into
// TemplateTab's activity editor without disturbing the existing 665-line
// authoring component. Owns its own data fetching (version state +
// history) keyed by activityId.
export default function TemplateVersionPanel({ operatorId, activityId, activityName }: {
  operatorId: string; activityId: string; activityName: string
}) {
  const [state, setState] = useState<ActivityVersionState | null>(null)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [sigCounts, setSigCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [diffFrom, setDiffFrom] = useState<TemplateVersion | null>(null)
  const [diffTo, setDiffTo] = useState<TemplateVersion | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [st, vs, counts] = await Promise.all([
        fetchActivityVersionState(activityId),
        listTemplateVersions(activityId),
        signatureCountsByVersion(activityId),
      ])
      setState(st); setVersions(vs); setSigCounts(counts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load version info')
    } finally {
      setLoading(false)
    }
  }, [activityId])

  useEffect(() => { refresh() }, [refresh])

  async function doPublish(changeNote: string, existingSessions: 'move' | 'pin') {
    setPublishing(true); setError(null)
    try {
      await publishTemplateVersion({ operatorId, activityId, changeNote: changeNote || undefined, existingSessions })
      setShowPublishForm(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <div className="text-xs text-gray-400 py-3">Loading version info…</div>

  const isFirstPublish = !state?.currentVersionId
  const hasChanges = state?.hasDraftChanges ?? true

  return (
    <div className="mt-4 border-t border-black/8 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</div>
          <div className="text-sm text-ink mt-0.5">
            {state?.currentVersionNumber
              ? <>Published v{state.currentVersionNumber}{hasChanges && <span className="text-amber-600"> · unpublished changes</span>}</>
              : <span className="text-amber-600">Not yet published</span>}
          </div>
        </div>
        {(hasChanges || isFirstPublish) && (
          <button onClick={() => setShowPublishForm(true)} disabled={publishing}
            className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
            {isFirstPublish ? 'Publish v1' : 'Publish new version'}
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-700">{error}</div>}

      {showPublishForm && (
        <PublishForm
          isFirstPublish={isFirstPublish}
          publishing={publishing}
          onCancel={() => setShowPublishForm(false)}
          onPublish={doPublish}
        />
      )}

      {versions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">History</div>
          {versions.map(v => (
            <div key={v.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs">
              <div>
                <span className="font-medium text-ink">v{v.versionNumber}</span>
                {v.changeNote && <span className="text-gray-500"> — {v.changeNote}</span>}
                <div className="text-gray-400 mt-0.5">
                  {new Date(v.publishedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  {v.publishedByEmail && <> · {v.publishedByEmail}</>}
                  {sigCounts[v.id] ? <> · {sigCounts[v.id]} signed</> : <> · 0 signed</>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => { setDiffFrom(v); setDiffTo(versions[0]) }}
                  disabled={v.id === versions[0].id}
                  className="text-brand underline disabled:opacity-30 disabled:no-underline"
                  title={v.id === versions[0].id ? 'This is the latest version' : `Compare v${v.versionNumber} with v${versions[0].versionNumber}`}>
                  {v.id === versions[0].id ? 'latest' : `diff vs v${versions[0].versionNumber}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {diffFrom && diffTo && (
        <DiffView from={diffFrom} to={diffTo} onClose={() => { setDiffFrom(null); setDiffTo(null) }} />
      )}
    </div>
  )
}

function PublishForm({ isFirstPublish, publishing, onCancel, onPublish }: {
  isFirstPublish: boolean; publishing: boolean
  onCancel: () => void; onPublish: (note: string, existing: 'move' | 'pin') => void
}) {
  const [note, setNote] = useState('')
  const [existingSessions, setExistingSessions] = useState<'move' | 'pin'>('move')

  return (
    <div className="bg-white rounded-xl border border-brand/20 p-4 mb-3">
      <div className="text-sm font-semibold text-ink mb-2">
        {isFirstPublish ? 'Publish first version' : 'Publish new version'}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        This captures the template exactly as it is now, as an immutable version participants sign against.
      </p>
      <label className="block text-xs text-gray-500 mb-1">What changed? (optional)</label>
      <input className="form-input text-sm mb-3" value={note} onChange={e => setNote(e.target.value)}
        placeholder="e.g. Reworded assumption of risk clause" />

      {!isFirstPublish && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1.5">Already-scheduled sessions</label>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="radio" checked={existingSessions === 'move'} onChange={() => setExistingSessions('move')} className="mt-0.5" />
              <span><span className="font-medium text-ink">Move them to the new version</span> — best for typo or wording fixes. Existing sessions will use the updated template.</span>
            </label>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="radio" checked={existingSessions === 'pin'} onChange={() => setExistingSessions('pin')} className="mt-0.5" />
              <span><span className="font-medium text-ink">Keep them on the current version</span> — best for substantive legal changes. Existing sessions stay pinned to what participants were already going to sign.</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-1.5 text-xs">Cancel</button>
        <button onClick={() => onPublish(note, existingSessions)} disabled={publishing} className="btn-primary py-1.5 text-xs">
          {publishing ? 'Publishing…' : isFirstPublish ? 'Publish v1' : 'Publish'}
        </button>
      </div>
    </div>
  )
}

// Minimal, readable diff between two version snapshots — clause and
// question level. Not a character-level redline (overkill for this);
// shows what was added, removed, or changed by title/text.
function DiffView({ from, to, onClose }: { from: TemplateVersion; to: TemplateVersion; onClose: () => void }) {
  const clauseDiff = diffByKey(
    from.snapshot.clauses.map(c => ({ key: c.key, label: c.title, body: c.bodyTemplate })),
    to.snapshot.clauses.map(c => ({ key: c.key, label: c.title, body: c.bodyTemplate })),
  )
  const qDiff = diffByKey(
    from.snapshot.questions.map(q => ({ key: q.key, label: q.text, body: q.triggerValue })),
    to.snapshot.questions.map(q => ({ key: q.key, label: q.text, body: q.triggerValue })),
  )

  return (
    <div className="mt-3 bg-white rounded-xl border border-black/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-ink">Changes: v{from.versionNumber} → v{to.versionNumber}</div>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-ink">Close ✕</button>
      </div>

      <DiffSection title="Clauses" diff={clauseDiff} />
      <DiffSection title="Questions" diff={qDiff} />

      {clauseDiff.added.length === 0 && clauseDiff.removed.length === 0 && clauseDiff.changed.length === 0 &&
       qDiff.added.length === 0 && qDiff.removed.length === 0 && qDiff.changed.length === 0 && (
        <div className="text-xs text-gray-400">No clause or question differences between these versions.</div>
      )}
    </div>
  )
}

function DiffSection({ title, diff }: { title: string; diff: DiffResult }) {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) return null
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{title}</div>
      <div className="space-y-1">
        {diff.added.map((item, i) => (
          <div key={`a${i}`} className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-1">+ Added: {item.label}</div>
        ))}
        {diff.removed.map((item, i) => (
          <div key={`r${i}`} className="text-xs bg-red-50 text-red-600 rounded px-2 py-1">− Removed: {item.label}</div>
        ))}
        {diff.changed.map((item, i) => (
          <div key={`c${i}`} className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-1">
            ~ Changed: {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

interface DiffItem { key: string; label: string; body: string }
interface DiffResult { added: DiffItem[]; removed: DiffItem[]; changed: DiffItem[] }

function diffByKey(fromItems: DiffItem[], toItems: DiffItem[]): DiffResult {
  const fromMap = new Map(fromItems.map(i => [i.key, i]))
  const toMap = new Map(toItems.map(i => [i.key, i]))
  const added:   DiffItem[] = []
  const removed: DiffItem[] = []
  const changed: DiffItem[] = []

  for (const [key, item] of Array.from(toMap)) {
    if (!fromMap.has(key)) added.push(item)
    else {
      const prev = fromMap.get(key)!
      if (prev.label !== item.label || prev.body !== item.body) changed.push(item)
    }
  }
  for (const [key, item] of Array.from(fromMap)) {
    if (!toMap.has(key)) removed.push(item)
  }
  return { added, removed, changed }
}
