// app/api/v1/waivers/[id]/route.ts
// Public API v1 — a waiver's signature status (scope waivers:read), with a
// short-lived signed PDF link when sealed. Operator-scoped by the API key.

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, logApiRequest, apiError, apiResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PDF_URL_TTL_SECONDS = 300   // 5 minutes

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request, 'waivers:read')
  if ('response' in auth) return auth.response
  const { ctx, admin } = auth

  try {
    const { data: waiver } = await admin
      .from('waivers')
      .select('id, signed_at, activity_key, is_minor, reservation_id, reservation_member_id, document_hash, pdf_path, created_at')
      .eq('id', params.id)
      .eq('operator_id', ctx.operatorId)   // operator scoping
      .maybeSingle()
    if (!waiver) { await logApiRequest(admin, ctx, request, 404); return apiError(404, 'not_found', 'Waiver not found.') }

    let pdfUrl: string | null = null
    if (waiver.pdf_path) {
      const { data: signed } = await admin.storage.from('waivers').createSignedUrl(waiver.pdf_path, PDF_URL_TTL_SECONDS)
      pdfUrl = signed?.signedUrl ?? null
    }

    await logApiRequest(admin, ctx, request, 200)
    return apiResponse(ctx, {
      id: waiver.id,
      signed: !!waiver.signed_at,
      signed_at: waiver.signed_at,
      activity_key: waiver.activity_key,
      is_minor: waiver.is_minor,
      reservation_id: waiver.reservation_id,
      reservation_member_id: waiver.reservation_member_id,
      document_hash: waiver.document_hash,
      pdf_url: pdfUrl,
      pdf_url_expires_in: pdfUrl ? PDF_URL_TTL_SECONDS : null,
      created_at: waiver.created_at,
    })
  } catch (e) {
    await logApiRequest(admin, ctx, request, 500)
    return apiError(500, 'server_error', e instanceof Error ? e.message : 'Failed to load waiver.')
  }
}
