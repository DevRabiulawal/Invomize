import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { getLocalShiftClock } from '@/lib/attendance'

export async function GET(_request: NextRequest) {
  const auth = await getApiSession()
  if (!auth.ok) return auth.response

  const { data: shift } = await auth.supabase
    .from('shift_config')
    .select('time_zone')
    .eq('company_id', auth.profile.company_id)
    .maybeSingle()
  if (!shift) return NextResponse.json({ error: 'Company shift configuration is missing.' }, { status: 409 })

  const date = getLocalShiftClock(new Date(), shift.time_zone).date
  const { data, error } = await auth.supabase.rpc('get_company_attendance_leaderboard', { p_as_of: date })
  if (error) {
    console.error('Leaderboard query failed', error)
    return NextResponse.json({ error: 'Unable to load the team leaderboard.' }, { status: 500 })
  }
  return NextResponse.json({ date, leaderboard: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}