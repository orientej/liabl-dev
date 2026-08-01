// app/api/v1/contacts/route.ts
// Public API v1 — opted-in marketing contacts (scope contacts:read). The
// bridge to a 3rd-party marketing platform: sync the audience Liabl captured
// consent for, then run volume/complex campaigns there. Operator-scoped by
// the API key; only contacts with at least one active (non-unsubscribed)
// channel consent are returned.
//
//   GET /api/v1/contacts?limit=&created_before=&channel=email|sms
//   -> { items: [...], next_cursor }

import { NextRequest } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError, apiResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'contacts:read')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500)
    const before = url.searchParams.get('created_before')
    const channel = url.searchParams.get('channel')   // optional: 'email' | 'sms'

    let q = admin.from('marketing_contacts')
      .select('email, phone, full_name, email_consent, sms_consent, email_consent_at, sms_consent_at, created_at')
      .eq('operator_id', ctx.operatorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (channel === 'email') q = q.eq('email_consent', true).is('unsubscribed_email_at', null)
    else if (channel === 'sms') q = q.eq('sms_consent', true).is('unsubscribed_sms_at', null)
    else {
      // Any active consent: (email_consent AND not unsub) OR (sms_consent AND not unsub).
      q = q.or('and(email_consent.eq.true,unsubscribed_email_at.is.null),and(sms_consent.eq.true,unsubscribed_sms_at.is.null)')
    }
    if (before) q = q.lt('created_at', before)

    const { data: rows, error } = await q
    if (error) throw new Error(error.message)

    const items = (rows ?? []).map(r => ({
      email: r.email, phone: r.phone, full_name: r.full_name,
      email_consent: r.email_consent, sms_consent: r.sms_consent,
      email_consent_at: r.email_consent_at, sms_consent_at: r.sms_consent_at,
      created_at: r.created_at,
    }))
    const nextCursor = items.length === limit ? items[items.length - 1].created_at : null

    await logApiRequest(admin, ctx, request, 200)
    return apiResponse(ctx, { items, next_cursor: nextCursor })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to list contacts.')
  }
}
