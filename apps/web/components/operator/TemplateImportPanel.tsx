'use client'
import { useState, useRef } from 'react'
import type { ActivityRecord } from '@/lib/document-engine'
import { saveReviewedClauses, type ReviewedClause } from '@/lib/template-import'
import { CLAUSE_CATEGORIES } from '@/lib/clause-categories'
import CompletenessCheck from '@/components/operator/CompletenessCheck'

// Content Management — waiver upload/parse, Stage 4: the operator-facing
// flow. Replaces the temporary UploadTestBox: upload a document, parse it
// into clauses, review and edit them, then save into a new or existing
// template as an unpublished draft.
//
// Review is edit-and-save-all (no per-clause approve/reject checkboxes) —
// the operator edits anything that's wrong and removes anything that
// shouldn't be there, then saves the set. The mandatory-human-review
// requirement is satisfied by the fact that nothing reaches the template
// model without passing through this screen, and nothing goes LIVE
// without a separate explicit publish afterward.

interface ParsedClause { title: string; body: string; category: string }

type Step = 'upload' | 'review'

export default function TemplateImportPanel({ operatorId, activities, onImported }: {
  operatorId: string
  activities: ActivityRecord[]
  onImported: (activityId: string) => void | Promise<void>
}) {
  const [step, setStep] = useState<Step>('upload')
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canManualFallback, setCanManualFallback] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [sourceText, setSourceText] = useState('')
  const [filename, setFilename] = useState('')
  const [clauses, setClauses] = useState<ParsedClause[]>([])
  const [unverifiedCount, setUnverifiedCount] = useState(0)

  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new')
  const [newName, setNewName] = useState('')
  const [existingId, setExistingId] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)

  function resetAll() {
    setStep('upload'); setError(null); setNotice(null); setSuccessMsg(null)
    setCanManualFallback(false); setSourceText(''); setFilename('')
    setClauses([]); setUnverifiedCount(0); setNewName(''); setExistingId('')
  }

  async function handleFile(file: File) {
    setBusy(true); setError(null); setNotice(null); setSuccessMsg(null); setCanManualFallback(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/templates/upload-extract', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Upload failed')
      setSourceText(body.text ?? '')
      setFilename(body.filename ?? file.name)
      if (body.notice) setNotice(body.notice)
      // Auto-continue into parsing when there's usable text — the
      // operator's intent in uploading is to get clauses, not raw text.
      if (body.text && body.text.trim().length >= 40) await runParse(body.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function runParse(text: string) {
    setParsing(true); setError(null); setCanManualFallback(false)
    try {
      const res = await fetch('/api/templates/segment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = await res.json()
      if (!res.ok) {
        setCanManualFallback(!!body.canManualFallback)
        throw new Error(body.error ?? 'Parse failed')
      }
      setClauses(body.clauses ?? [])
      setUnverifiedCount(body.unverifiedCount ?? 0)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  function updateClause(index: number, patch: Partial<ParsedClause>) {
    setClauses(prev => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function removeClause(index: number) {
    setClauses(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const reviewed: ReviewedClause[] = clauses.map(c => ({
        title: c.title, body: c.body, category: c.category,
      }))
      const target = targetMode === 'new'
        ? { mode: 'new' as const, displayName: newName }
        : { mode: 'existing' as const, activityId: existingId }

      const result = await saveReviewedClauses(operatorId, target, reviewed)
      setSuccessMsg(
        `Saved ${result.clausesAdded} clause${result.clausesAdded === 1 ? '' : 's'} to ` +
        `${result.createdNew ? 'a new template' : 'the selected template'}. ` +
        `It\u2019s saved as a draft \u2014 open it below and publish when you\u2019re ready.`
      )
      setStep('upload')
      setClauses([])
      setSourceText('')
      await onImported(result.activityId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canSave = clauses.length > 0 && (targetMode === 'new' ? newName.trim().length > 0 : existingId.length > 0)

  return (
    <div className="mb-6 border border-black/10 rounded-xl p-4 bg-surface">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-ink">Import a waiver</h2>
        {step === 'review' && (
          <button onClick={resetAll} className="text-xs text-gray-400 hover:text-ink underline">Start over</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Upload an existing waiver (PDF, Word, or text) and we&apos;ll split it into clauses you can review before saving.
      </p>

      {successMsg && (
        <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-700">{successMsg}</div>
      )}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          {error}
          {canManualFallback && (
            <div className="mt-1 text-red-600">
              You can still build this template by hand — use “+ New activity” above and add clauses manually.
            </div>
          )}
        </div>
      )}
      {notice && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">{notice}</div>
      )}

      {step === 'upload' && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy || parsing}
            className="text-xs px-3 py-2 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Reading document…' : parsing ? 'Finding clauses…' : 'Choose a file'}
          </button>
          {sourceText && !parsing && clauses.length === 0 && (
            <button
              onClick={() => runParse(sourceText)}
              className="ml-2 text-xs px-3 py-2 border border-brand/40 text-brand rounded-lg font-medium hover:bg-brand/10"
            >
              Retry parsing
            </button>
          )}
        </>
      )}

      {step === 'review' && (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Found <span className="text-ink font-medium">{clauses.length}</span> clause{clauses.length === 1 ? '' : 's'}
            {filename && <> in <span className="text-ink">{filename}</span></>}. Edit anything that looks wrong, then save.
          </div>

          {unverifiedCount > 0 && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
              {unverifiedCount} clause{unverifiedCount === 1 ? '' : 's'} couldn&apos;t be matched word-for-word to the original
              document, which can mean the wording was altered. Please compare {unverifiedCount === 1 ? 'it' : 'them'} against
              your source before saving.
            </div>
          )}

          <div className="space-y-3 mb-4">
            {clauses.map((c, i) => (
              <div key={i} className="bg-white border border-black/10 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <input
                    value={c.title}
                    onChange={e => updateClause(i, { title: e.target.value })}
                    className="form-input text-xs font-medium flex-1"
                    placeholder="Clause title"
                  />
                  <select
                    value={c.category}
                    onChange={e => updateClause(i, { category: e.target.value })}
                    className="text-xs border border-black/10 rounded-lg px-2 py-1.5 shrink-0"
                  >
                    {CLAUSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeClause(i)}
                    className="text-xs text-red-500 hover:text-red-700 underline shrink-0 py-1.5"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={c.body}
                  onChange={e => updateClause(i, { body: e.target.value })}
                  className="w-full text-xs border border-black/10 rounded-lg p-2 h-28 font-mono"
                  placeholder="Clause text"
                />
              </div>
            ))}
          </div>

          {clauses.length === 0 && (
            <div className="text-xs text-gray-400 mb-4">
              All clauses removed. Start over to upload a different document.
            </div>
          )}

          <CompletenessCheck clauses={clauses.map(c => ({ title: c.title, body: c.body }))} />

          <div className="border-t border-black/8 pt-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Save to</label>
            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'new'} onChange={() => setTargetMode('new')} />
                <span>A new template</span>
              </label>
              {targetMode === 'new' && (
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="form-input text-xs ml-5"
                  placeholder="Template name (e.g. Kayak Rental Waiver)"
                />
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'existing'} onChange={() => setTargetMode('existing')} />
                <span>An existing template</span>
              </label>
              {targetMode === 'existing' && (
                <select
                  value={existingId}
                  onChange={e => setExistingId(e.target.value)}
                  className="form-input text-xs ml-5"
                >
                  <option value="">Choose a template…</option>
                  {activities.map(a => (
                    <option key={a.id} value={a.id}>{a.displayName}</option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-2">
              Clauses are saved as a draft. Nothing is shown to participants until you publish.
            </p>

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="text-xs px-3 py-2 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save ${clauses.length} clause${clauses.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
