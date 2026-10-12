'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loginSchema } from '@/lib/validators'
import { isOfficeNetwork } from '@/lib/network'
import { createSupabaseServerClient, hasSupabasePublicConfig } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/app-config'

export type LoginState = { error: string } | null

export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    portal: formData.get('portal'),
  })
  if (!parsed.success) return { error: 'Enter a valid email, password, and portal.' }
  if (!hasSupabasePublicConfig()) return { error: 'Authentication is not configured. Add the Supabase environment values first.' }

  const requestHeaders = await headers()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error || !data.user) return { error: 'Email or password is incorrect.' }

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role, company_id, employment_status').eq('id', data.user.id).maybeSingle()
  if (profileError || !profile || !profile.company_id || profile.employment_status === 'INACTIVE') {
    await supabase.auth.signOut()
    return { error: `This account is not active in a ${getAppConfig().appName} workspace. Contact your HR administrator.` }
  }
  if (profile.role !== parsed.data.portal) {
    await supabase.auth.signOut()
    return { error: `This account uses the ${profile.role === 'HR' ? 'HR' : 'employee'} portal.` }
  }
  if (profile.role === 'EMPLOYEE' && !isOfficeNetwork(requestHeaders)) {
    await supabase.auth.signOut()
    return { error: 'Employee sign-in is only available from the registered office network.' }
  }

  redirect(profile.role === 'HR' ? '/hr' : '/employee')
}