import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { leaveDecisionSchema } from '@/lib/validators'

export async function PATCH(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) }
  const parsed = leaveDecisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid leave decision.', details: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { data, error } = await auth.supabase.from('leave_requests').update({
    status: parsed.data.decision,
    reviewed_by: auth.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', parsed.data.requestId).eq('company_id', auth.profile.company_id).eq('status', 'PENDING')
    .select('id, status, reviewed_by, reviewed_at').maybeSingle()

  if (error) {
    console.error('Leave approval update failed', error)
    return NextResponse.json({ error: 'Unable to process leave request.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Pending leave request was not found in your company.' }, { status: 404 })
  return NextResponse.json({ request: data }, { headers: { 'Cache-Control': 'no-store' } })
}