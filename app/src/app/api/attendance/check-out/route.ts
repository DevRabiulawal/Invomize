import { NextRequest, NextResponse } from 'next/server'
import { getApiSession, requireOfficeNetwork } from '@/lib/api-auth'
import { getLocalShiftClock } from '@/lib/attendance'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError

  const auth = await getApiSession()
  if (!auth.ok) return auth.response
  const networkError = requireOfficeNetwork(request, auth.profile.role)
  if (networkError) return networkError
  if (auth.profile.employment_status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Only active employees can check out.' }, { status: 403 })
  }

  const { data: shift } = await auth.supabase
    .from('shift_config')
    .select('time_zone')
    .eq('company_id', auth.profile.company_id)
    .maybeSingle()

  if (!shift) return NextResponse.json({ error: 'Company shift configuration is missing.' }, { status: 409 })

  const checkedOutAt = new Date()
  const localClock = getLocalShiftClock(checkedOutAt, shift.time_zone)

  let adminClient: ReturnType<typeof createSupabaseAdminClient>
  try {
    adminClient = createSupabaseAdminClient()
  } catch (error) {
    console.error('Attendance service is not configured', error)
    return NextResponse.json({ error: 'Attendance service is not configured.' }, { status: 503 })
  }

  const activeAttendanceResult = await adminClient
    .from('attendance_logs')
    .select('id, date, checked_in_at, checked_out_at, status, late_minutes, penalty_points')
    .eq('company_id', auth.profile.company_id)
    .eq('user_id', auth.user.id)
    .order('checked_in_at', { ascending: false })
    .limit(20)

  if (activeAttendanceResult.error && activeAttendanceResult.error.code === '42703') {
    return NextResponse.json({ error: 'Your Supabase schema is missing the checkout column. Run the latest attendance migration before checking out.' }, { status: 409 })
  }

  const activeAttendance = activeAttendanceResult.data ?? []
  const targetRow = activeAttendance.find((record) => record.checked_out_at == null && (record.date === localClock.date || record.checked_in_at?.startsWith(localClock.date)))
    ?? activeAttendance.find((record) => record.checked_out_at == null)

  if (!targetRow) {
    return NextResponse.json({ error: 'You are not checked in for today.' }, { status: 409 })
  }

  const checkoutResult = await adminClient
    .from('attendance_logs')
    .update({ checked_out_at: checkedOutAt.toISOString() })
    .eq('id', targetRow.id)
    .select('id, date, checked_in_at, checked_out_at, status, late_minutes, penalty_points')
    .single()

  if (checkoutResult.error) {
    console.error('Checkout update failed', checkoutResult.error)
    return NextResponse.json({ error: 'Unable to record your checkout time.' }, { status: 500 })
  }

  return NextResponse.json({ attendance: checkoutResult.data }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
