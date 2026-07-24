// app/api/client-ip/route.ts
// Returns the client's IP address as seen by the server.
// Called once at signing time to populate waivers.ip_address.
//
// Vercel (and most reverse proxies) set x-forwarded-for to the real client
// IP. We take the first entry in the list, which is the original client
// before any intermediate proxies.
//
// This is a server-side route so we have access to real request headers,
// unlike the client component (ParticipantFlow.tsx) which can only see
// what the browser exposes.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp    = request.headers.get('x-real-ip')

  // x-forwarded-for can be a comma-separated list: "client, proxy1, proxy2"
  // The first entry is the actual client IP.
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : realIp ?? null

  return NextResponse.json({ ip })
}
