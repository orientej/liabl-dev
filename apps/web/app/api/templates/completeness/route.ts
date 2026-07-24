// app/api/templates/completeness/route.ts
// Waiver completeness check.
//
// Stateless by design: takes a clause set in the request, returns the
// findings, touches no database at all — no reads, no writes, no cache.
// That's the locked decision on this feature: a persisted assessment
// would be a discoverable record of known deficiencies, so results exist
// only in the response and in the operator's browser until they navigate
// away.
//
// Accepting clauses in the body (rather than an activityId to look up)
// is also what lets one route serve both call sites: the upload review
// screen, where the clauses aren't saved anywhere yet, and an existing
// template, where the client already holds them.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { checkCompleteness, CompletenessError, type ClauseForCheck } from '@/lib/completeness-check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
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

  let body: { clauses?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const rawClauses = Array.isArray(body.clauses) ? body.clauses : []
  const clauses: ClauseForCheck[] = rawClauses
    .map(c => {
      const item = c as { title?: unknown; body?: unknown }
      return {
        title: typeof item.title === 'string' ? item.title : '',
        body:  typeof item.body  === 'string' ? item.body  : '',
      }
    })
    .filter(c => c.body.trim().length > 0)

  if (clauses.length === 0) {
    return NextResponse.json({ error: 'No clauses to check' }, { status: 400 })
  }

  try {
    const result = await checkCompleteness(clauses)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof CompletenessError
      ? err.message
      : 'The completeness check failed unexpectedly'
    console.error('[completeness] failed:', err)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
