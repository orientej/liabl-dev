import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()
    const { data, error } = await supabase.from('waivers').insert({ ...body, signed_at: new Date().toISOString(), ip_address: req.headers.get('x-forwarded-for') ?? 'unknown' }).select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
