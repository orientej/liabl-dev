// app/api/branding/route.ts
// Private labeling — save an operator's branding (operator console,
// authenticated). Colors are validated server-side; the operator is taken
// from the logged-in session, never the body, and the row is upserted for
// that operator only. Logo files are uploaded client-side to the public
// 'branding' bucket; this route stores the resulting URL.
//
//   POST /api/branding
//     { logoUrl?: string|null, primaryColor?: string|null,
//       accentColor?: string|null, hidePoweredBy?: boolean }
//   -> { ok: true }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isValidHex } from '@/lib/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normColor(v: unknown): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string' && isValidHex(v)) return v.trim()
  return 'invalid'
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  const primary = normColor(body.primaryColor)
  const accent = normColor(body.accentColor)
  if (primary === 'invalid' || accent === 'invalid') {
    return NextResponse.json({ error: 'Colors must be #RRGGBB hex values.' }, { status: 400 })
  }

  const logoUrl: string | null = typeof body.logoUrl === 'string' && body.logoUrl.trim() ? body.logoUrl.trim() : null
  if (logoUrl && !/^https:\/\//i.test(logoUrl)) {
    return NextResponse.json({ error: 'Logo URL must be https.' }, { status: 400 })
  }
  const hidePoweredBy = !!body.hidePoweredBy

  // Authorize: a logged-in operator member.
  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('operator_members')
    .select('operator_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No operator account for this user' }, { status: 403 })

  const { error } = await admin
    .from('operator_branding')
    .upsert({
      operator_id:     membership.operator_id,
      logo_url:        logoUrl,
      primary_color:   primary,
      accent_color:    accent,
      hide_powered_by: hidePoweredBy,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'operator_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
