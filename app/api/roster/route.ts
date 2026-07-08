import { NextRequest, NextResponse } from 'next/server'

// This route always fetches live data and reads nothing from the request
// (no headers, cookies, or params) — with no dynamic signal to key off,
// Next's App Router can otherwise try to statically prerender it at
// build time, which fails since there's no live network/env context
// available then. Force it to run per-request instead.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { createClient } = await import('@/lib/supabase')
  const supabase = createClient()
  const { data, error } = await supabase.from('waivers').select('id,signed_at,activity_key,is_minor,participants(full_name,email)').order('created_at', { ascending:true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
