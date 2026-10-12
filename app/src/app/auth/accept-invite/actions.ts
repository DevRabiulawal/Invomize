'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedProfile } from '@/lib/server-auth'

export async function acceptInvitation(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  if (password.length < 12 || password.length > 128) redirect('/auth/accept-invite?error=password')
  if (password !== confirmation) redirect('/auth/accept-invite?error=mismatch')

  const session = await getAuthenticatedProfile()
  if (!session?.profile.company_id) redirect('/login')
  const { error } = await session.supabase.auth.updateUser({ password })
  if (error) redirect('/auth/accept-invite?error=update')
  redirect(session.profile.role === 'HR' ? '/hr' : '/employee')
}