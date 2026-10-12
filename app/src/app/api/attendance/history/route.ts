import { NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { getLocalShiftClock } from '@/lib/attendance'

export async function GET() {
  const auth = await getApiSession()
  if (!auth.ok) return auth.response

  let attendanceQuery = auth.supabase
    .from('attendance_logs')
    .select('id, date, checked_in_at, checked_out_at, status, late_minutes, penalty_points')
    .eq('user_id', auth.user.id)
    .order('date', { ascending: false })
    .limit(90)

  let attendanceResult: any = await attendanceQuery
  if (attendanceResult.error && attendanceResult.error.code === '42703') {
    attendanceResult = await auth.supabase
      .from('attendance_logs')
      .select('id, date, checked_in_at, status, late_minutes, penalty_points')
      .eq('user_id', auth.user.id)
      .order('date', { ascending: false })
      .limit(90)
  }

  const [{ data: shift }, { data: scoreRows, error: scoreError }] = await Promise.all([
    auth.supabase.from('shift_config').select('time_zone').eq('company_id', auth.profile.company_id).maybeSingle(),
    auth.supabase.rpc('get_my_attendance_score'),
  ])

  const attendance = attendanceResult.data
  const attendanceError = attendanceResult.error

  if (!shift || attendanceError || scoreError) {
    console.error('Attendance history query failed', attendanceError ?? scoreError)
    return NextResponse.json({ error: 'Unable to load attendance history.' }, { status: 500 })
  }
  const today = getLocalShiftClock(new Date(), shift.time_zone).date
  return NextResponse.json({ attendance: attendance ?? [], score: scoreRows?.[0] ?? null, today }, { headers: { 'Cache-Control': 'private, no-store' } })
}