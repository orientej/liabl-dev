// app/api/templates/upload-extract/route.ts
// Content Management — waiver upload/parse, Stage 1.
//
// Accepts a single uploaded document, extracts its text, and returns it.
// This is the PREVIEW/extraction step only — it deliberately does NOT
// write anything to the database. Parsing into clauses (Stage 3) and
// saving a reviewed template (Stage 4) are separate steps; keeping
// extraction side-effect-free means an operator can upload, see what
// came out, and back out without having created anything.
//
// Auth: requires an authenticated operator member. Extraction is
// CPU/memory work on operator-supplied files, so it must not be open —
// an unauthenticated caller could use it to burn resources. We don't
// need the operator's identity for anything in the response, just proof
// they're a real logged-in member, so the check is intentionally light
// (any authenticated operator member is fine).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { extractText, UnsupportedFormatError } from '@/lib/document-extract'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Guard against very large uploads — extraction of a huge file could
// exceed serverless memory/time. 15MB comfortably covers any real
// waiver document (even a long scanned one) without inviting abuse.
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // Confirm the caller is actually an operator member (not just any
  // authenticated Supabase user) before doing extraction work for them.
  const { data: membership } = await supabase
    .from('operator_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'Not an operator member' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart file upload' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is too large (15MB max)' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await extractText({
      buffer,
      mimeType: file.type,
      filename: file.name,
    })

    // A born-digital PDF that yielded almost no text is really a scan —
    // OCR (Stage 2, Azure) will handle these, but it isn't wired up yet.
    // Tell the operator plainly rather than handing back an empty result
    // that looks like a parsing failure.
    if (result.likelyScanned) {
      return NextResponse.json({
        text: result.text,
        method: result.method,
        pageCount: result.pageCount,
        likelyScanned: true,
        notice: 'This looks like a scanned document (an image of text). Automatic text recognition for scans is coming soon — for now, upload a text-based PDF, a Word file, or paste the text directly.',
      })
    }

    return NextResponse.json({
      text: result.text,
      method: result.method,
      pageCount: result.pageCount,
      likelyScanned: false,
      filename: file.name,
    })
  } catch (err) {
    if (err instanceof UnsupportedFormatError) {
      return NextResponse.json({ error: err.message }, { status: 415 })
    }
    console.error('[upload-extract] extraction failed:', err)
    return NextResponse.json(
      { error: 'Could not read text from this file. It may be corrupted or password-protected.' },
      { status: 422 }
    )
  }
}
