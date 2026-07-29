'use client'
// Multi-document check-in — operator view of the supplemental documents
// signed in a check-in, shown inside WaiverDetail. Self-contained so it
// slots in with a single line and doesn't enlarge WaiverDetail's own
// state. Reads signed_documents (RLS-scoped to the operator) and opens
// each sealed PDF via a short-lived signed URL.
import { useState, useEffect } from 'react'

interface SignedDocRow {
  id: string
  title_snapshot: string
  signed_at: string
  pdf_path: string | null
  seal_error: string | null
}

export default function SignedDocumentsSection({ waiverId, isDemo }: { waiverId: string; isDemo?: boolean }) {
  const [docs, setDocs] = useState<SignedDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { data, error } = await supabase
          .from('signed_documents')
          .select('id, title_snapshot, signed_at, pdf_path, seal_error')
          .eq('waiver_id', waiverId)
          .order('created_at')
        if (error) throw error
        if (!cancelled) { setDocs(data ?? []); setLoading(false) }
      } catch {
        if (!cancelled) { setError(true); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [waiverId, isDemo])

  async function openPdf(id: string) {
    setOpening(id)
    try {
      const res = await fetch(`/api/signed-documents/${id}/pdf-url`)
      const body = await res.json()
      if (res.ok && body.url) {
        window.open(body.url, '_blank', 'noopener')
      }
    } catch { /* non-fatal */ } finally {
      setOpening(null)
    }
  }

  // Nothing to show for a check-in with no supplemental documents — stay
  // invisible rather than adding an empty section.
  if (isDemo || (!loading && !error && docs.length === 0)) return null

  return (
    <div className="bg-white rounded-xl border border-black/10 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Supplemental Documents
      </div>
      {loading && <div className="px-4 py-4 text-xs text-gray-400">Loading documents…</div>}
      {error && <div className="px-4 py-4 text-xs text-red-500">Couldn&apos;t load documents.</div>}
      {!loading && !error && docs.map(d => {
        const time = new Date(d.signed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const sealed = !!d.pdf_path
        return (
          <div key={d.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 last:border-0 text-xs">
            <div className="flex-1">
              <div className="font-medium text-ink">{d.title_snapshot}</div>
              <div className="text-gray-400">
                Signed {time}
                {!sealed && <span className="text-amber-600"> · seal pending{d.seal_error ? ' (error)' : ''}</span>}
              </div>
            </div>
            {sealed && (
              <button onClick={() => openPdf(d.id)} disabled={opening === d.id}
                className="px-2.5 py-1 rounded-lg border border-black/10 text-gray-600 hover:text-ink hover:border-black/20">
                {opening === d.id ? 'Opening…' : 'View PDF'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
