'use client'
import { useState, useRef } from 'react'

// TEMPORARY — Stage 1 testing surface for the waiver upload/parse
// feature. Lets an operator upload a file and see the extracted text,
// so extraction quality can be confirmed on real documents before the
// rest of the pipeline (Azure OCR, Claude segmentation, review UI) is
// built. This whole component is meant to be REPLACED by the real
// upload+review flow in Stage 4 — it's deliberately self-contained and
// mounts in one place so it's a clean delete later.
export default function UploadTestBox() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    text: string; method: string; pageCount: number | null
    likelyScanned: boolean; notice?: string; filename?: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setBusy(true); setError(null); setResult(null)
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

  return (
    <div className="mb-6 border border-dashed border-brand/40 rounded-xl p-4 bg-brand/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-brand uppercase tracking-wider">Upload test</span>
        <span className="text-xs text-gray-400">(temporary — Stage 1 extraction preview)</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Upload a waiver (PDF, Word .docx, or .txt) to see the extracted text. Nothing is saved.
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
            className="w-full h-64 text-xs font-mono border border-black/10 rounded-lg p-2 bg-white"
            placeholder="(no text extracted)"
          />
        </div>
      )}
    </div>
  )
}
