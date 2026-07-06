import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const { createClient } = await import('@/lib/supabase')
  const supabase = createClient()
  const { data, error } = await supabase.from('waivers').select('id,signed_at,activity_key,is_minor,participants(full_name,email)').order('created_at', { ascending:true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
