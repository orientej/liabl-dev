// app/api/signed-documents/[id]/pdf-url/route.ts
// Multi-document check-in — the signed_documents equivalent of
// app/api/waivers/[id]/pdf-url/route.ts. Generates a short-lived signed
// URL on demand for a supplemental document's sealed PDF, using the
// CALLER's own session so RLS (signed_documents_select_own_operator)
// scopes access to the requester's operator with no extra authorization
// logic here — a caller from another operator (or unauthenticated) simply
// gets no row back.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 300   // 5 minutes, same as the waiver route

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Missing signed document id' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: doc, error } = await supabase
    .from('signed_documents')
    .select('pdf_path')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!doc.pdf_path) {
    return NextResponse.json({ error: 'No sealed document on file — either not yet sealed, or sealing failed' }, { status: 404 })
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('waivers')
    .createSignedUrl(doc.pdf_path, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: signError?.message ?? 'failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS })
}
