// app/api/waivers/[id]/seal-writeback/route.ts
// v25 fix — the client-side anon UPDATE to waivers (document_hash,
// pdf_path, seal_error) has proven unreliable: confirmed that PDFs are
// actually being generated and uploaded to Storage successfully, but the
// row never gets linked, with no thrown error anywhere in the client —
// meaning the UPDATE is being silently filtered to zero rows affected
// (which Supabase's client reports as "no error", not an exception).
//
// Rather than keep chasing the exact RLS mechanism, this sidesteps it
// entirely: the participant flow now calls this route (over HTTPS, right
// after sealWaiver() returns) instead of writing directly. This uses the
// service-role client, same proven pattern as /api/invites/accept,
// /api/admin/*, and the retention job — bypassing RLS for a narrow,
// well-defined write rather than depending on the anon policy that's
// been the source of this whole investigation.
//
// Guardrails, since this is reachable by an anonymous caller right after
// they sign their own waiver:
// - Only succeeds for a waiver that's actually signed (signed_at is set)
//   and doesn't already have a pdf_path — prevents this being used to
//   arbitrarily overwrite an already-sealed waiver's hash/path.
// - Accepts either a success payload (documentHash + pdfPath) or a
//   failure payload (sealError) — same route handles both, since both
//   were previously separate, equally-unreliable direct writes.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const waiverId = params.id
  if (!waiverId) {
    return NextResponse.json({ error: 'Missing waiver id' }, { status: 400 })
  }

  const body = await request.json()
  const { documentHash, pdfPath, sealError } = body as {
    documentHash?: string; pdfPath?: string; sealError?: string
  }

  if (!documentHash && !pdfPath && !sealError) {
    return NextResponse.json({ error: 'Nothing to write' }, { status: 400 })
  }

  const client = createAdminClient()

  const { data: waiver, error: lookupError } = await client
    .from('waivers')
    .select('id, signed_at, pdf_path')
    .eq('id', waiverId)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!waiver || !waiver.signed_at) {
    return NextResponse.json({ error: 'Waiver not found or not signed' }, { status: 404 })
  }
  if (waiver.pdf_path && (documentHash || pdfPath)) {
    // Already sealed — don't allow overwriting an existing hash/path.
    return NextResponse.json({ error: 'Waiver is already sealed' }, { status: 409 })
  }

  const patch: Record<string, unknown> = {}
  if (documentHash) patch.document_hash = documentHash
  if (pdfPath)       patch.pdf_path      = pdfPath
  if (documentHash && pdfPath) patch.seal_error = null // success clears any prior failure
  if (sealError)     patch.seal_error    = sealError

  const { error: updateError } = await client.from('waivers').update(patch).eq('id', waiverId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ written: true })
}
