'use client'
import { useState, useRef } from 'react'

interface SegmentedClause { title: string; body: string; category: string }

// TEMPORARY — Stage 1 + Stage 3 testing surface for the waiver
// upload/parse feature. Upload a file to see extracted text (Stage 1),
// then optionally parse it into labeled clauses via Claude (Stage 3).
// Meant to be REPLACED by the real upload+review flow in Stage 4 —
// deliberately self-contained so it's a clean delete later.
export default function UploadTestBox() {
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [canManualFallback, setCanManualFallback] = useState(false)
  const [clauses, setClauses] = useState<SegmentedClause[] | null>(null)
  const [unverifiedCount, setUnverifiedCount] = useState(0)
  const [result, setResult] = useState<{
    text: string; method: string; pageCount: number | null
    likelyScanned: boolean; notice?: string; filename?: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setBusy(true); setError(null); setResult(null)
    setClauses(null); setParseError(null); setCanManualFallback(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/templates/upload-extract', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Upload failed')
      setResult(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleParse() {
    if (!result?.text) return
    setParsing(true); setParseError(null); setClauses(null); setCanManualFallback(false)
    try {
      const res = await fetch('/api/templates/segment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.text }),
      })
      const body = await res.json()
      if (!res.ok) {
        setCanManualFallback(!!body.canManualFallback)
        throw new Error(body.error ?? 'Parse failed')
      }
      setClauses(body.clauses)
      setUnverifiedCount(body.unverifiedCount ?? 0)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="mb-6 border border-dashed border-brand/40 rounded-xl p-4 bg-brand/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-brand uppercase tracking-wider">Upload test</span>
        <span className="text-xs text-gray-400">(temporary — Stage 1 + 3 preview)</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Upload a waiver (PDF, Word .docx, or .txt) to see the extracted text, then parse it into clauses. Nothing is saved.
      </p>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-xs px-3 py-2 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Extracting…' : 'Choose file'}
        </button>
        {result && result.text && (
          <button
            onClick={handleParse}
            disabled={parsing}
            className="text-xs px-3 py-2 border border-brand/40 text-brand rounded-lg font-medium hover:bg-brand/10 disabled:opacity-50"
          >
            {parsing ? 'Parsing…' : 'Parse into clauses'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {result.filename && <span>File: <span className="text-ink">{result.filename}</span></span>}
            <span>Method: <span className="text-ink">{result.method}</span></span>
            {result.pageCount != null && <span>Pages: <span className="text-ink">{result.pageCount}</span></span>}
            {result.likelyScanned && <span className="text-amber-600">Looks scanned</span>}
          </div>
          {result.notice && (
            <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">{result.notice}</div>
          )}
          <textarea
            readOnly
            value={result.text}
            className="w-full h-40 text-xs font-mono border border-black/10 rounded-lg p-2 bg-white"
            placeholder="(no text extracted)"
          />
        </div>
      )}

      {parseError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          {parseError}
          {canManualFallback && <div className="mt-1 text-red-600">(You can still create the template manually below.)</div>}
        </div>
      )}

      {clauses && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5">
            Parsed <span className="text-ink font-medium">{clauses.length}</span> clause{clauses.length === 1 ? '' : 's'}
            {unverifiedCount > 0 && (
              <span className="text-amber-600"> · {unverifiedCount} could not be verified as verbatim (review carefully)</span>
            )}
          </div>
          <div className="space-y-2">
            {clauses.map((c, i) => (
              <div key={i} className="bg-white border border-black/10 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-ink">{c.title}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">{c.category}</span>
                </div>
                <div className="text-xs text-gray-600 whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

