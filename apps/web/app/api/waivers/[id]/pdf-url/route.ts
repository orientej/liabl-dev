// app/api/waivers/[id]/pdf-url/route.ts
// v25 M6 security review — generates a short-lived signed URL on demand,
// replacing the old approach (lib/seal.ts used to generate and store a
// single 10-year signed URL at upload time). See 015_m6_pdf_path.sql for
// the full reasoning.
//
// Uses the CALLER's own session (lib/supabase-server.ts), not the
// service-role admin client — deliberately. RLS's existing
// waivers_select_own_operator policy (011_m5_rls_tighten.sql) already
// correctly scopes SELECT to the requester's own operator; reusing that
// here means this route needs no separate authorization logic of its
// own; an unauthenticated caller or one from a different operator simply
// gets no row back, the same as any other query against this table.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 300   // 5 minutes — long enough to open and view, short enough that a leaked link is useless within the hour

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const waiverId = params.id
  if (!waiverId) {
    return NextResponse.json({ error: 'Missing waiver id' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: waiver, error } = await supabase
    .from('waivers')
    .select('pdf_path')
    .eq('id', waiverId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!waiver) {
    // Could mean: doesn't exist, belongs to a different operator (RLS
    // filtered it out), or the caller isn't authenticated at all. Same
    // response either way — not confirming which avoids leaking whether
    // a given waiver ID exists to someone who shouldn't see it.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!waiver.pdf_path) {
    return NextResponse.json(
      { error: 'No sealed document on file — either not yet sealed, or redacted after the 90-day retention window' },
      { status: 404 }
    )
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('waivers')
    .createSignedUrl(waiver.pdf_path, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: signError?.message ?? 'failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS })
}
