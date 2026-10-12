import { NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'

export async function GET() {
  const auth = await getApiSession()
  if (!auth.ok) return auth.response
  const query = auth.supabase.from('leave_requests')
    .select('id, user_id, leave_type, start_date, end_date, working_days, reason, status, reviewed_by, reviewed_at, created_at')
    .eq('company_id', auth.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(200)
  const { data, error } = await query
  if (error) {
    console.error('Leave request list failed', error)
    return NextResponse.json({ error: 'Unable to load leave requests.' }, { status: 500 })
  }
  const requesterIds = [...new Set((data ?? []).map((request) => request.user_id))]
  const { data: profiles, error: profileError } = requesterIds.length
    ? await auth.supabase.from('profiles').select('id, full_name').in('id', requesterIds)
    : { data: [], error: null }
  if (profileError) {
    console.error('Leave requester profiles query failed', profileError)
    return NextResponse.json({ error: 'Unable to load leave requesters.' }, { status: 500 })
  }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const requests = (data ?? []).map((request) => ({ ...request, employee_name: names.get(request.user_id) ?? 'Team member' }))
  return NextResponse.json({ requests, role: auth.profile.role, userId: auth.user.id }, { headers: { 'Cache-Control': 'private, no-store' } })
}