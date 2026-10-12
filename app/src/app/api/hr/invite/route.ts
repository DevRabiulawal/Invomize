import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { inviteSchema } from '@/lib/validators'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) }
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation details.', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  const appOrigin = process.env.APP_ORIGIN
  if (!appOrigin) return NextResponse.json({ error: 'APP_ORIGIN is not configured.' }, { status: 503 })

  try {
    const admin = createSupabaseAdminClient()
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: new URL('/auth/callback?purpose=invite', appOrigin).toString(),
    })
    if (inviteError || !invited.user) {
      if (inviteError?.code === 'email_exists') return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      console.error('Supabase invitation failed', inviteError)
      return NextResponse.json({ error: 'Unable to send employee invitation.' }, { status: 502 })
    }

    const { error: profileError } = await admin.from('profiles').update({
      company_id: auth.profile.company_id,
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
      department: parsed.data.department || null,
      role: 'EMPLOYEE',
      employment_status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    }).eq('id', invited.user.id)

    if (profileError) {
      console.error('Invited account profile setup failed', profileError)
      const { error: cleanupError } = await admin.auth.admin.deleteUser(invited.user.id)
      if (cleanupError) console.error('Failed to remove incomplete invited account', cleanupError)
      return NextResponse.json({ error: 'Invitation setup failed. No employee account was retained.' }, { status: 500 })
    }

    return NextResponse.json({ invited: { id: invited.user.id, email: parsed.data.email, fullName: parsed.data.fullName, role: 'EMPLOYEE' } }, { status: 201 })
  } catch (error) {
    console.error('Invitation service is not configured', error)
    return NextResponse.json({ error: 'Invitation service is not configured.' }, { status: 503 })
  }
}