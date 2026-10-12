import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { secondsFromTime } from '@/lib/attendance'
import { shiftConfigSchema } from '@/lib/validators'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response
  const { data, error } = await auth.supabase.from('shift_config').select('*').eq('company_id', auth.profile.company_id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Shift configuration was not found.' }, { status: 404 })
  return NextResponse.json({ shift: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) }
  const parsed = shiftConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid shift configuration.', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  if (secondsFromTime(parsed.data.shiftEnd) <= secondsFromTime(parsed.data.shiftStart)) {
    return NextResponse.json({ error: 'Shift end must be after shift start on the same day.' }, { status: 400 })
  }

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.from('shift_config').upsert({
      company_id: auth.profile.company_id,
      shift_start: parsed.data.shiftStart,
      shift_end: parsed.data.shiftEnd,
      grace_minutes: parsed.data.graceMinutes,
      late_penalty_points: parsed.data.latePenaltyPoints,
      max_daily_base: parsed.data.maxDailyBase,
      time_zone: parsed.data.timeZone,
      working_days: parsed.data.workingDays,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }).select('*').single()
    if (error) {
      console.error('Shift configuration update failed', error)
      return NextResponse.json({ error: 'Unable to update shift configuration.' }, { status: 500 })
    }
    return NextResponse.json({ shift: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Shift configuration service is not configured', error)
    return NextResponse.json({ error: 'Shift configuration service is not configured.' }, { status: 503 })
  }
}