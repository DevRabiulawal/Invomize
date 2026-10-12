import { NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'

export async function GET() {
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response
  const { data, error } = await auth.supabase.from('profiles')
    .select('id, email, full_name, role, job_title, department, employment_status, created_at')
    .eq('company_id', auth.profile.company_id)
    .order('full_name', { ascending: true })
    .limit(500)
  if (error) {
    console.error('Employee directory query failed', error)
    return NextResponse.json({ error: 'Unable to load employees.' }, { status: 500 })
  }
  return NextResponse.json({ employees: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}