import { after, NextResponse, type NextRequest } from 'next/server'
import { appendToGoogleSheet } from '@/lib/googleSheets'
import { assessCheckIn, getLocalShiftClock } from '@/lib/attendance'
import { getApiSession, requireOfficeNetwork } from '@/lib/api-auth'
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
    return NextResponse.json({ error: 'Only active employees can check in.' }, { status: 403 })
  }

  const { data: shift, error: shiftError } = await auth.supabase
    .from('shift_config')
    .select('shift_start, grace_minutes, late_penalty_points, time_zone, working_days')
    .eq('company_id', auth.profile.company_id)
    .maybeSingle()

  if (shiftError || !shift) return NextResponse.json({ error: 'Company shift configuration is missing.' }, { status: 409 })

  const checkedInAt = new Date()
  let localClock: ReturnType<typeof getLocalShiftClock>
  try {
    localClock = getLocalShiftClock(checkedInAt, shift.time_zone)
  } catch {
    return NextResponse.json({ error: 'Company time zone is invalid.' }, { status: 500 })
  }
  if (!shift.working_days.includes(localClock.isoWeekday)) {
    return NextResponse.json({ error: 'Today is not a configured work day.' }, { status: 409 })
  }

  const classification = assessCheckIn(localClock.secondsSinceMidnight, shift.shift_start, shift.grace_minutes, shift.late_penalty_points)
  let admin: ReturnType<typeof createSupabaseAdminClient>
  try {
    admin = createSupabaseAdminClient()
  } catch (error) {
    console.error('Attendance service is not configured', error)
    return NextResponse.json({ error: 'Attendance service is not configured.' }, { status: 503 })
  }

  const { data: attendance, error } = await admin
    .from('attendance_logs')
    .insert({
      company_id: auth.profile.company_id,
      user_id: auth.user.id,
      date: localClock.date,
      checked_in_at: checkedInAt.toISOString(),
      status: classification.status,
      late_minutes: classification.lateMinutes,
      penalty_points: classification.penaltyPoints,
    })
    .select('id, date, checked_in_at, status, late_minutes, penalty_points')
    .single()

  if (error?.code === '23505') return NextResponse.json({ error: 'You have already checked in today.' }, { status: 409 })
  if (error || !attendance) {
    console.error('Attendance insert failed', error)
    return NextResponse.json({ error: 'Unable to record attendance.' }, { status: 500 })
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    after(async () => {
      try {
        await appendToGoogleSheet({
          date: attendance.date,
          fullName: auth.profile.full_name,
          email: auth.profile.email,
          checkInTime: new Intl.DateTimeFormat('en-US', { timeZone: shift.time_zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(checkedInAt),
          status: classification.status,
          penaltyPoints: attendance.penalty_points,
        })
        await admin.from('attendance_logs').update({ sheets_synced_at: new Date().toISOString(), sheets_sync_attempts: 1, sheets_last_error: null }).eq('id', attendance.id)
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message.slice(0, 500) : 'Google Sheets sync failed.'
        console.error('Google Sheets attendance sync failed', syncError)
        await admin.from('attendance_logs').update({ sheets_sync_attempts: 1, sheets_last_error: message }).eq('id', attendance.id)
      }
    })
  }

  return NextResponse.json({ attendance }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}