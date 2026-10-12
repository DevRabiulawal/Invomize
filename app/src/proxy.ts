import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './lib/database.types'
import { isOfficeNetwork } from './lib/network'

function copySessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  for (const name of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(name)
    if (value) target.headers.set(name, value)
  }
  return target
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isCheckIn = pathname === '/api/attendance/check-in'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    if (isCheckIn) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
    return NextResponse.redirect(new URL('/login?error=configuration', request.url))
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    if (isCheckIn) return copySessionCookies(response, NextResponse.json({ error: 'Authentication required.' }, { status: 401 }))
    return copySessionCookies(response, NextResponse.redirect(new URL('/login', request.url)))
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, company_id, employment_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.company_id || profile.employment_status === 'INACTIVE') {
    if (isCheckIn) return copySessionCookies(response, NextResponse.json({ error: 'A configured active profile is required.' }, { status: 403 }))
    return copySessionCookies(response, NextResponse.redirect(new URL('/login?error=profile-not-configured', request.url)))
  }

  if (isCheckIn && profile.role === 'EMPLOYEE' && !isOfficeNetwork(request.headers)) {
    return copySessionCookies(response, NextResponse.json({ error: 'Check-in is only available from the registered office network.' }, { status: 403 }))
  }

  if (pathname.startsWith('/hr/') && profile.role !== 'HR') {
    return copySessionCookies(response, NextResponse.redirect(new URL('/employee', request.url)))
  }
  if (pathname.startsWith('/employee/') && profile.role !== 'EMPLOYEE') {
    return copySessionCookies(response, NextResponse.redirect(new URL('/hr', request.url)))
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/employee/:path*', '/hr/:path*', '/api/attendance/check-in'],
}