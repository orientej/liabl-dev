'use client'
// Multi-document check-in — operator authoring of supplemental documents
// (photo release, code of conduct, …). Mirrors TemplateTab's shape: a
// list on the left, an editor on the right, with an explicit publish that
// snapshots an immutable version. A published, non-archived document is
// what participants sign at check-in (resolved by lib/signed-documents).
import { useState, useEffect, useCallback } from 'react'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { getCurrentOperatorMember } from '@/lib/auth'
import {
  listDocumentTemplates, createDocumentTemplate, updateDocumentTemplate,
  setDocumentTemplateActivities, setDocumentTemplateArchived, publishDocumentVersion,
  setMinorGuardianSignatureMode, type DocumentTemplateRecord,
} from '@/lib/document-templates'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

export default function DocumentsTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [guardianMode, setGuardianMode] = useState<'per_document' | 'single'>('per_document')
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [documents, setDocuments] = useState<DocumentTemplateRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Editor draft fields (local until saved)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [required, setRequired] = useState(true)
  const [appliesTo, setAppliesTo] = useState<'all' | 'activities'>('all')
  const [activityIds, setActivityIds] = useState<string[]>([])

  const selected = documents.find(d => d.id === selectedId) ?? null

  const refresh = useCallback(async (keepSelection = true) => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account found for your login.')
      setOperatorId(member.operatorId)

      const { createClient } = await import('@/lib/supabase')
      const engine = await fetchEngineData(createClient(), undefined, { includeUnpublished: true })
      setActivities(engine.activities)
      setGuardianMode(engine.minorGuardianSignatureMode)

      const docs = await listDocumentTemplates(member.operatorId)
      setDocuments(docs)
      if (!keepSelection || !docs.some(d => d.id === selectedId)) {
        setSelectedId(docs[0]?.id ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load editor fields whenever the selected document changes.
  useEffect(() => {
    if (selected) {
      setTitle(selected.title)
      setBody(selected.body)
      setRequired(selected.required)
      setAppliesTo(selected.appliesTo)
      setActivityIds(selected.activityIds)
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    const name = prompt('New document title (e.g. "Photo & Media Release")')?.trim()
    if (!name) return
    setBusy(true); setError(null)
    try {
      if (!operatorId) throw new Error('Operator not loaded yet.')
      const id = await createDocumentTemplate({ operatorId, key: slugify(name) || `doc-${Date.now()}`, title: name })
      await refresh(false)
      setSelectedId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create document')
    } finally { setBusy(false) }
  }

  async function handleSaveDraft() {
    if (!selected || !operatorId) return
    setBusy(true); setError(null)
    try {
      await updateDocumentTemplate(selected.id, { title, body, required, appliesTo })
      if (appliesTo === 'activities') {
        await setDocumentTemplateActivities(selected.id, operatorId, activityIds)
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setBusy(false) }
  }

  async function handlePublish() {
    if (!selected || !operatorId) return
    setBusy(true); setError(null)
    try {
      // Save any pending edits first so the published snapshot matches
      // what's on screen.
      await updateDocumentTemplate(selected.id, { title, body, required, appliesTo })
      if (appliesTo === 'activities') {
        await setDocumentTemplateActivities(selected.id, operatorId, activityIds)
      }
      await publishDocumentVersion({ operatorId, documentTemplateId: selected.id })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish')
    } finally { setBusy(false) }
  }

  async function handleArchiveToggle() {
    if (!selected) return
    setBusy(true); setError(null)
    try {
      await setDocumentTemplateArchived(selected.id, !selected.archivedAt)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    } finally { setBusy(false) }
  }

  async function handleGuardianMode(mode: 'per_document' | 'single') {
    if (!operatorId) return
    setGuardianMode(mode)
    try {
      await setMinorGuardianSignatureMode(operatorId, mode)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update guardian mode')
    }
  }

  function toggleActivity(id: string) {
    setActivityIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (loading) return <div className="text-sm text-gray-500">Loading documents…</div>

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Supplemental documents</h2>
        <p className="text-sm text-gray-500">
          Documents participants sign at check-in in addition to the liability waiver — a photo release,
          code of conduct, rental agreement, and so on. Published, non-archived documents apply automatically.
        </p>
      </div>

      {/* Minor guardian signature mode — operator-wide setting */}
      <div className="card mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Minor guardian signatures</div>
        <p className="text-sm text-gray-500 mb-3">
          When a minor checks in, how should the guardian sign supplemental documents?
        </p>
        <div className="flex gap-3 flex-wrap">
          {([
            ['per_document', 'A signature on each document', 'Most defensible — the guardian signs every required document.'],
            ['single', 'One signature for the whole check-in', 'The guardian signs once; that signature applies to every document.'],
          ] as const).map(([value, label, hint]) => (
            <button key={value} onClick={() => handleGuardianMode(value)}
              className={`text-left rounded-xl border p-3 flex-1 min-w-[220px] transition-all ${
                guardianMode === value ? 'border-brand bg-brand/5' : 'border-black/10 hover:border-black/20'
              }`}>
              <div className="text-sm font-medium text-ink mb-0.5">{label}</div>
              <div className="text-xs text-gray-500">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* List */}
        <div className="md:col-span-1">
          <button onClick={handleCreate} disabled={busy} className="btn-primary w-full mb-3 text-sm">+ New document</button>
          <div className="space-y-2">
            {documents.length === 0 && <p className="text-sm text-gray-400">No documents yet.</p>}
            {documents.map(d => (
              <button key={d.id} onClick={() => setSelectedId(d.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  selectedId === d.id ? 'border-brand bg-brand/5' : 'border-black/10 hover:border-black/20'
                } ${d.archivedAt ? 'opacity-60' : ''}`}>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {d.title || '(untitled)'}
                  {d.archivedAt && <span className="text-[10px] uppercase text-gray-400 border border-black/10 rounded px-1">Archived</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>{d.required ? 'Required' : 'Optional'}</span>
                  <span>·</span>
                  <span>{d.currentVersionNumber ? `v${d.currentVersionNumber}` : 'Unpublished'}</span>
                  {d.hasDraftChanges && d.currentVersionNumber && <span className="text-amber-600">· unpublished changes</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="card text-sm text-gray-500">Select a document, or create one.</div>
          ) : (
            <div className="card space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Body <span className="text-gray-400">— supports {'{{name}}'}, {'{{activity}}'}, {'{{date}}'}</span>
                </label>
                <textarea className="form-input min-h-[220px] font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                Required — participants must sign this to complete check-in
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Applies to</label>
                <div className="flex gap-2 mb-2">
                  {(['all', 'activities'] as const).map(v => (
                    <button key={v} onClick={() => setAppliesTo(v)}
                      className={`text-sm px-3 py-1.5 rounded-lg border ${
                        appliesTo === v ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 text-gray-500'
                      }`}>
                      {v === 'all' ? 'All activities' : 'Specific activities'}
                    </button>
                  ))}
                </div>
                {appliesTo === 'activities' && (
                  <div className="flex flex-wrap gap-2">
                    {activities.map(a => (
                      <label key={a.id} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
                        activityIds.includes(a.id) ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 text-gray-500'
                      }`}>
                        <input type="checkbox" className="sr-only" checked={activityIds.includes(a.id)} onChange={() => toggleActivity(a.id)} />
                        {a.displayName}
                      </label>
                    ))}
                    {activities.length === 0 && <span className="text-xs text-gray-400">No activities yet.</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-black/5">
                <button onClick={handleSaveDraft} disabled={busy} className="btn-secondary text-sm">Save draft</button>
                <button onClick={handlePublish} disabled={busy} className="btn-primary text-sm">
                  {selected.currentVersionNumber ? 'Publish new version' : 'Publish'}
                </button>
                <button onClick={handleArchiveToggle} disabled={busy} className="text-sm text-gray-400 hover:text-gray-600 underline ml-auto">
                  {selected.archivedAt ? 'Restore' : 'Archive'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
