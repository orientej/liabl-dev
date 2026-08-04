// app/api/auth/trusted-device/route.ts
// "Remember this device" — the server side of the MFA trust bypass.
//
//   GET    — is THIS browser a trusted device for the current user?
//   POST   — mark this browser trusted for 30 days (called right after a
//            successful second-factor verification, if the user opted in).
//   DELETE — untrust this browser (revoke the row + clear the cookie).
//
// SECURITY:
//   * The user is ALWAYS derived from the authenticated session via
//     getUser() — never from the request body or a query param. A caller
//     cannot mark a device trusted for someone else.
//   * The device secret is random, returned to the browser only inside an
//     HttpOnly + Secure cookie, and stored server-side only as its SHA-256
//     hash — the plaintext is never persisted (same model as api_keys).
//   * Trust is revocable: deleting the row (here or from settings) makes
//     the next middleware check fail even though the cookie still exists.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createHash, randomBytes } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COOKIE = 'liabl_td'
const MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

function sha256(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

async function currentUserId(): Promise<string | null> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE)?.value
  if (!raw) return NextResponse.json({ trusted: false })

  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ trusted: false })

  const admin = createAdminClient()
  const { data } = await admin
    .from('trusted_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('token_hash', sha256(raw))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) return NextResponse.json({ trusted: false })

  // Best-effort recency touch — not awaited-critical.
  await admin.from('trusted_devices').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return NextResponse.json({ trusted: true })
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const secret = randomBytes(32).toString('hex')
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null
  const expiresAt = new Date(Date.now() + MAX_AGE_S * 1000).toISOString()

  const admin = createAdminClient()
  const { error } = await admin.from('trusted_devices').insert({
    user_id: userId,
    token_hash: sha256(secret),
    user_agent: userAgent,
    expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, secret, { ...cookieOpts, maxAge: MAX_AGE_S })
  return res
}

export async function DELETE(request: NextRequest) {
  const raw = request.cookies.get(COOKIE)?.value
  const userId = await currentUserId()
  if (userId && raw) {
    const admin = createAdminClient()
    await admin.from('trusted_devices').delete().eq('user_id', userId).eq('token_hash', sha256(raw))
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '', { ...cookieOpts, maxAge: 0 })
  return res
}
