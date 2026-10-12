import type { NextRequest } from 'next/server'

export function rejectCrossOriginMutation(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return Response.json({ error: 'Origin header is required.' }, { status: 403 })

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return Response.json({ error: 'Invalid Origin header.' }, { status: 403 })
  }

  const allowedHost = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).host : request.nextUrl.host
  if (originHost !== allowedHost || request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Cross-origin request blocked.' }, { status: 403 })
  }
  return null
}