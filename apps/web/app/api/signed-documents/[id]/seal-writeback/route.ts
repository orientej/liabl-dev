// app/api/signed-documents/[id]/seal-writeback/route.ts
// Multi-document check-in — the signed_documents equivalent of
// app/api/waivers/[id]/seal-writeback/route.ts, and for the same reason:
// the anonymous participant's direct UPDATE to write document_hash /
// pdf_path back onto the row it just inserted gets silently filtered to
// zero rows by RLS (signed_documents has no anon SELECT policy, so the
// PostgREST update-then-return path affects nothing). This service-role
// route sidesteps that with a narrow, well-defined write, exactly like
// the waiver route.
//
// Guardrails, since an anonymous caller can reach this right after
// signing their own document:
// - Only succeeds for a row that exists and doesn't already have a
//   pdf_path — so it can't overwrite an already-sealed document.
// - Accepts either a success payload (documentHash + pdfPath) or a
//   failure payload (sealError).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Missing signed document id' }, { status: 400 })
  }

  const body = await request.json()
  const { documentHash, pdfPath, sealError } = body as {
    documentHash?: string; pdfPath?: string; sealError?: string
  }

  if (!documentHash && !pdfPath && !sealError) {
    return NextResponse.json({ error: 'Nothing to write' }, { status: 400 })
  }

  const client = createAdminClient()

  const { data: doc, error: lookupError } = await client
    .from('signed_documents')
    .select('id, pdf_path')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!doc) {
    return NextResponse.json({ error: 'Signed document not found' }, { status: 404 })
  }
  if (doc.pdf_path && (documentHash || pdfPath)) {
    return NextResponse.json({ error: 'Document is already sealed' }, { status: 409 })
  }

  const patch: Record<string, unknown> = {}
  if (documentHash) patch.document_hash = documentHash
  if (pdfPath)       patch.pdf_path      = pdfPath
  if (documentHash && pdfPath) patch.seal_error = null // success clears any prior failure
  if (sealError)     patch.seal_error    = sealError

  const { error: updateError } = await client.from('signed_documents').update(patch).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ written: true })
}
