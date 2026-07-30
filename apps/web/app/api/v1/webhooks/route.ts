// app/api/v1/webhooks/route.ts
// Public API v1 — programmatic webhook management (scope webhooks:manage).
// The console (app/api/webhooks + lib/webhooks-client) is the human path;
// this is the same capability for developers driving it from code. Every
// query is scoped to the operator resolved from the API KEY.
//
//   GET    /api/v1/webhooks            -> { endpoints: [...] }   (no secrets)
//   POST   /api/v1/webhooks  { url, events[], description? }
//                                      -> { id, url, events, secret }  (once)
//   DELETE /api/v1/webhooks?id=<id>    -> { deleted: true }

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError, apiResponse } from '@/lib/api-auth'
import { generateWebhookSecret, WEBHOOK_EVENTS } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'webhooks:manage')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth
  try {
    const { data, error } = await admin
      .from('webhook_endpoints')
      .select('id, url, event_types, active, description, last_delivery_at, created_at')
      .eq('operator_id', ctx.operatorId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    await logApiRequest(admin, ctx, request, 200)
    return apiResponse(ctx, {
      endpoints: (data ?? []).map(e => ({
        id: e.id, url: e.url, events: e.event_types ?? [], active: e.active,
        description: e.description, last_delivery_at: e.last_delivery_at, created_at: e.created_at,
      })),
    })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to list webhooks.')
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'webhooks:manage')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth
  try {
    const body = await request.json().catch(() => ({}))
    let parsed: URL | null = null
    try { parsed = new URL((body.url as string | undefined)?.trim() || '') } catch { parsed = null }
    if (!parsed || parsed.protocol !== 'https:') {
      await logApiRequest(admin, ctx, request, 400)
      return apiError(400, 'invalid_request', 'A valid https:// url is required.')
    }
    const events: string[] = (Array.isArray(body.events) ? body.events : []).filter((e: string) => (WEBHOOK_EVENTS as readonly string[]).includes(e))
    if (events.length === 0) {
      await logApiRequest(admin, ctx, request, 400)
      return apiError(400, 'invalid_request', `Subscribe to at least one event: ${WEBHOOK_EVENTS.join(', ')}.`)
    }

    const secret = generateWebhookSecret()
    const { data: inserted, error } = await admin
      .from('webhook_endpoints')
      .insert({
        operator_id: ctx.operatorId,
        url: parsed.toString(),
        secret,
        event_types: events,
        description: (body.description as string | undefined)?.trim() || null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    await logApiRequest(admin, ctx, request, 201)
    // secret returned once, never again
    return apiResponse(ctx, { id: inserted!.id, url: parsed.toString(), events, secret }, { status: 201 })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to create webhook.')
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateApiRequest(request, 'webhooks:manage')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) { await logApiRequest(admin, ctx, request, 400); return apiError(400, 'invalid_request', 'Provide ?id=<webhook id>.') }
    // Operator-scoped delete — a key can only remove its own operator's endpoints.
    const { data: existing } = await admin
      .from('webhook_endpoints').select('id').eq('id', id).eq('operator_id', ctx.operatorId).maybeSingle()
    if (!existing) { await logApiRequest(admin, ctx, request, 404); return apiError(404, 'not_found', 'Webhook not found.') }
    const { error } = await admin.from('webhook_endpoints').delete().eq('id', id).eq('operator_id', ctx.operatorId)
    if (error) throw new Error(error.message)
    await logApiRequest(admin, ctx, request, 200)
    return apiResponse(ctx, { deleted: true })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to delete webhook.')
  }
}
