// app/api/templates/segment/route.ts
// Content Management — waiver upload/parse, Stage 3.
//
// Takes text (already extracted client-side via the upload-extract step)
// and returns Claude-segmented clauses. Kept as a SEPARATE route from
// upload-extract deliberately: extraction is fast and free, segmentation
// is a slower, paid AI call — separating them means the operator sees
// the extracted text immediately (Stage 1 UX) and only spends the AI
// call when they choose to parse it. It also keeps each route single-
// purpose and each independently testable.
//
// Like upload-extract, this is side-effect-free — no DB writes. Saving a
// reviewed template happens in Stage 4. On any AI failure or malformed
// output, returns a clear error plus canManualFallback:true so the UI
// can offer "create the template manually instead" — a bad parse never
// traps the operator.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { segmentClauses, SegmentationError } from '@/lib/clause-segment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// AI segmentation can take longer than a default serverless budget on a
// long document; give it headroom. (Vercel respects this on Pro.)
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: membership } = await supabase
    .from('operator_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'Not an operator member' }, { status: 403 })
  }

  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text : ''
  if (text.trim().length < 40) {
    return NextResponse.json({ error: 'Not enough text to parse' }, { status: 400 })
  }

  try {
    const result = await segmentClauses(text)
    return NextResponse.json({
      clauses: result.clauses,
      unverifiedCount: result.unverifiedCount,
    })
  } catch (err) {
    // Every failure mode here is recoverable by the operator creating the
    // template manually, so always signal the fallback path rather than
    // presenting a dead end.
    const message = err instanceof SegmentationError
      ? err.message
      : 'Automatic parsing failed unexpectedly'
    console.error('[segment] failed:', err)
    return NextResponse.json(
      {
        error: `Couldn\u2019t automatically parse this document (${message}). You can still create the template manually and paste sections in.`,
        canManualFallback: true,
      },
      { status: 422 }
    )
  }
}
