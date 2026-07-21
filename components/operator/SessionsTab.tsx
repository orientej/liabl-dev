'use client'
import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { listSessions, createSession, deleteSession, listVersionsForActivity, setSessionPinnedVersion, type SessionRecord, type AvailableVersion } from '@/lib/sessions'

export default function SessionsTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { createClient } = await import('@/lib/supabase')
      const engineData = await fetchEngineData(createClient())
      setOperatorId(engineData.operatorId)
      setActivities(engineData.activities)
      setSessions(await listSessions(engineData.operatorId))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = sessions.filter(s => s.sessionDate >= today)
  const past = sessions.filter(s => s.sessionDate < today)

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading sessions…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Check-in sessions</h1>
          <p className="text-sm text-gray-400">Create a session for each tour timeslot, then share its link or QR code at check-in.</p>
        </div>
        <button onClick={() => setCreating(true)} className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90 shrink-0">
          + New session
        </button>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      {creating && operatorId && (
        <CreateSessionForm
          operatorId={operatorId}
          activities={activities}
          onCancel={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await refresh() }}
          onError={setActionError}
        />
      )}

      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Today &amp; upcoming</div>
          <div className="space-y-2">
            {upcoming.map(s => (
              <SessionRow key={s.id} session={s} activities={activities} operatorId={operatorId} expanded={expandedId === s.id}
                onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onDeleted={refresh} onError={setActionError} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Past</div>
          <div className="space-y-2">
            {past.map(s => (
              <SessionRow key={s.id} session={s} activities={activities} operatorId={operatorId} expanded={expandedId === s.id}
                onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onDeleted={refresh} onError={setActionError} />
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && !creating && (
        <div className="text-center text-sm text-gray-400 py-10">No sessions yet. Click &quot;+ New session&quot; to create your first check-in link.</div>
      )}
    </div>
  )
}

function CreateSessionForm({ operatorId, activities, onCancel, onCreated, onError }: {
  operatorId: string; activities: ActivityRecord[]
  onCancel: () => void; onCreated: () => Promise<void>; onError: (e: string) => void
}) {
  const [sessionRef, setSessionRef] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [activityKey, setActivityKey] = useState(activities[0]?.key ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!sessionRef.trim() || !activityKey) return
    setSubmitting(true)
    try {
      await createSession({ operatorId, sessionRef, sessionTime, sessionDate, activityKey })
      await onCreated()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-5 mb-6">
      <h3 className="font-semibold text-sm text-ink mb-4">New session</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Label</label>
          <input className="form-input" value={sessionRef} onChange={e => setSessionRef(e.target.value)} placeholder="e.g. AM-04" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Activity</label>
          <select className="form-input" value={activityKey} onChange={e => setActivityKey(e.target.value)}>
            {activities.map(a => <option key={a.key} value={a.key}>{a.displayName}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" className="form-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Time (optional)</label>
          <input className="form-input" value={sessionTime} onChange={e => setSessionTime(e.target.value)} placeholder="e.g. 9:00 AM" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-2 text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting || !sessionRef.trim() || !activityKey} className="btn-primary py-2 text-sm">
          {submitting ? 'Creating…' : 'Create session'}
        </button>
      </div>
    </div>
  )
}

function SessionRow({ session, activities, operatorId, expanded, onToggle, onDeleted, onError }: {
  session: SessionRecord; activities: ActivityRecord[]; operatorId: string | null; expanded: boolean
  onToggle: () => void; onDeleted: () => Promise<void>; onError: (e: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [availableVersions, setAvailableVersions] = useState<AvailableVersion[]>([])
  const [savingVersion, setSavingVersion] = useState(false)

  const activity = activities.find(a => a.key === session.activityKey)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/participant/session/${session.id}` : ''

  useEffect(() => {
    if (expanded && !qrDataUrl && url) {
      QRCode.toDataURL(url, { width: 200, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => onError('Failed to generate QR code'))
    }
  }, [expanded, qrDataUrl, url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the available versions for this session's activity when expanded,
  // so the operator can pin the session to a specific one.
  useEffect(() => {
    if (expanded && operatorId && availableVersions.length === 0) {
      listVersionsForActivity(operatorId, session.activityKey)
        .then(setAvailableVersions)
        .catch(() => { /* non-fatal — the control just won't populate */ })
    }
  }, [expanded, operatorId, session.activityKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeVersion(value: string) {
    setSavingVersion(true)
    try {
      // '' (the "follow current" option) -> null pin; otherwise pin to the id
      await setSessionPinnedVersion(session.id, value || null)
      await onDeleted() // reuses the parent's refresh
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update version')
    } finally {
      setSavingVersion(false)
    }
  }

  // What this session actually resolves to right now: its pin if set,
  // else the activity's current published version.
  const effectiveVersionNumber = session.pinnedVersionNumber ?? session.activityCurrentVersionNumber
  const isPinned = session.pinnedVersionId !== null

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onError('Could not copy — your browser may be blocking clipboard access')
    }
  }

  async function confirmedDelete() {
    setDeleting(true)
    try {
      await deleteSession(session.id)
      await onDeleted()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete session')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
      <div onClick={onToggle} className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink text-sm">{session.sessionRef || 'Untitled'}</span>
            {session.waiverCount > 0 && (
              <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">{session.waiverCount} signed</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {activity?.displayName ?? session.activityKey} · {new Date(session.sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
            {session.sessionTime ? ` · ${session.sessionTime}` : ''}
            {effectiveVersionNumber != null && (
              <span> · v{effectiveVersionNumber}{isPinned ? ' (pinned)' : ''}</span>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="p-4 border-t border-black/8 bg-surface">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="shrink-0">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code for check-in link" className="rounded-lg border border-black/10" width={140} height={140} />
              ) : (
                <div className="w-[140px] h-[140px] bg-black/5 rounded-lg animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-1">Check-in link</label>
              <div className="flex gap-2 mb-4">
                <input readOnly value={url} className="form-input text-xs font-mono flex-1" onClick={e => (e.target as HTMLInputElement).select()} />
                <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="text-xs px-3 py-2 rounded-lg border border-black/10 hover:bg-white shrink-0 whitespace-nowrap">
                  View
                </button>
                <button onClick={copyLink} className="text-xs px-3 py-2 rounded-lg border border-black/10 hover:bg-white shrink-0 whitespace-nowrap">
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Template version</label>
                {availableVersions.length === 0 ? (
                  <p className="text-xs text-gray-400">This activity has no published versions yet.</p>
                ) : (
                  <>
                    <select
                      value={session.pinnedVersionId ?? ''}
                      onChange={e => changeVersion(e.target.value)}
                      disabled={savingVersion}
                      className="form-input text-xs"
                    >
                      <option value="">
                        Follow current{session.activityCurrentVersionNumber != null ? ` (v${session.activityCurrentVersionNumber})` : ''}
                      </option>
                      {availableVersions.map(v => (
                        <option key={v.id} value={v.id}>Pin to v{v.versionNumber}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {isPinned
                        ? `This session stays on v${session.pinnedVersionNumber} even when the template is republished.`
                        : 'This session always uses the activity\u2019s latest published version.'}
                    </p>
                  </>
                )}
              </div>

              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 underline">Delete session</button>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-red-700">Delete this session?</span>
                  <button onClick={confirmedDelete} disabled={deleting} className="text-red-700 font-medium underline">{deleting ? 'Deleting…' : 'Confirm'}</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-gray-400 underline">Cancel</button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
