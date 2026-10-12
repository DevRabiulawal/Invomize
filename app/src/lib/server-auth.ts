import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from './database.types'
import { createSupabaseServerClient } from './supabase/server'

export type AuthenticatedProfile = {
  id: string
  company_id: string | null
  company_name: string | null
  email: string
  full_name: string
  role: UserRole
  job_title: string | null
  department: string | null
  employment_status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'
}

export async function getAuthenticatedProfile(): Promise<{ user: User; profile: AuthenticatedProfile; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> } | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient()
  } catch {
    return null
  }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_id, email, full_name, role, job_title, department, employment_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) return null
  let companyName: string | null = null
  if (profile.company_id) {
    const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).maybeSingle()
    companyName = company?.name ?? null
  }
  return { user, profile: { ...profile, company_name: companyName }, supabase }
}

export async function requireRole(role: UserRole) {
  const session = await getAuthenticatedProfile()
  if (!session) redirect('/login')
  if (session.profile.role !== role) redirect(session.profile.role === 'HR' ? '/hr' : '/employee')
  if (!session.profile.company_id) redirect('/login?error=profile-not-configured')
  return { ...session, profile: session.profile as AuthenticatedProfile & { company_id: string } }
}