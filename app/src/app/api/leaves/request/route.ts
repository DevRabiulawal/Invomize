import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { countWorkingDays, getLocalShiftClock } from '@/lib/attendance'
import { leaveRequestSchema } from '@/lib/validators'

const leaveTypeMap = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  PERSONAL: 'Personal day',
  UNPAID: 'Unpaid leave',
} as const

function isCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError
  const auth = await getApiSession()
  if (!auth.ok) return auth.response

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) }
  const parsed = leaveRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid leave request.', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  if (!isCalendarDate(parsed.data.startDate) || !isCalendarDate(parsed.data.endDate)) {
    return NextResponse.json({ error: 'Dates must be valid calendar dates.' }, { status: 400 })
  }
  if (new Date(`${parsed.data.endDate}T00:00:00Z`).getTime() - new Date(`${parsed.data.startDate}T00:00:00Z`).getTime() > 90 * 86400000) {
    return NextResponse.json({ error: 'Leave requests cannot exceed 90 calendar days.' }, { status: 400 })
  }

  const { data: shift, error: shiftError } = await auth.supabase.from('shift_config')
    .select('time_zone, working_days').eq('company_id', auth.profile.company_id).maybeSingle()
  if (shiftError || !shift) return NextResponse.json({ error: 'Company leave calendar is not configured.' }, { status: 409 })
  const today = getLocalShiftClock(new Date(), shift.time_zone).date
  if (parsed.data.startDate < today) return NextResponse.json({ error: 'Leave cannot start in the past.' }, { status: 400 })

  const workingDays = countWorkingDays(parsed.data.startDate, parsed.data.endDate, shift.working_days)
  if (workingDays < 1 || workingDays > 90) return NextResponse.json({ error: 'The requested range contains no valid working days.' }, { status: 400 })

  const { data, error } = await auth.supabase.from('leave_requests').insert({
    company_id: auth.profile.company_id,
    user_id: auth.user.id,
    leave_type: leaveTypeMap[parsed.data.leaveType],
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    working_days: workingDays,
    reason: parsed.data.reason,
  }).select('id, leave_type, start_date, end_date, working_days, status, created_at').single()

  if (error || !data) {
    console.error('Leave request insert failed', error)
    return NextResponse.json({ error: 'Unable to submit leave request.' }, { status: 500 })
  }
  return NextResponse.json({ request: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}