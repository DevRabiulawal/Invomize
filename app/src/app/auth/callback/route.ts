import { NextRequest, NextResponse } from 'next/server'
import { isOfficeNetwork } from '@/lib/network'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const isEmployeeInvite = request.nextUrl.searchParams.get('purpose') === 'invite'
  if (isEmployeeInvite && !isOfficeNetwork(request.headers)) {
    return NextResponse.redirect(new URL('/login?error=office-network', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=invalid-invitation', request.url))

  const supabase = await createSupabaseServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return NextResponse.redirect(new URL('/login?error=invalid-invitation', request.url))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?error=invalid-invitation', request.url))
  const { data: profile } = await supabase.from('profiles').select('role, company_id, employment_status').eq('id', user.id).maybeSingle()
  if (!profile || !profile.company_id || profile.employment_status === 'INACTIVE') {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=profile-not-configured', request.url))
  }
  if (profile.role === 'EMPLOYEE' && !isOfficeNetwork(request.headers)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=office-network', request.url))
  }
  return NextResponse.redirect(new URL('/auth/accept-invite', request.url))
}