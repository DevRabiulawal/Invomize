import 'server-only'
import type { NextRequest } from 'next/server'
import type { UserRole } from './database.types'
import { isOfficeNetwork } from './network'
import { getAuthenticatedProfile } from './server-auth'

export async function getApiSession(role?: UserRole) {
  try {
    const session = await getAuthenticatedProfile()
    if (!session) return { ok: false as const, response: Response.json({ error: 'Authentication required.' }, { status: 401 }) }
    if (!session.profile.company_id) return { ok: false as const, response: Response.json({ error: 'Account is not assigned to a company.' }, { status: 403 }) }
    if (session.profile.employment_status === 'INACTIVE') return { ok: false as const, response: Response.json({ error: 'This account is inactive.' }, { status: 403 }) }
    if (role && session.profile.role !== role) return { ok: false as const, response: Response.json({ error: 'Insufficient permissions.' }, { status: 403 }) }
    return { ok: true as const, ...session, profile: { ...session.profile, company_id: session.profile.company_id } }
  } catch (error) {
    console.error('Unable to create authenticated Supabase session', error)
    return { ok: false as const, response: Response.json({ error: 'Authentication service is not configured.' }, { status: 503 }) }
  }
}

export function requireOfficeNetwork(request: NextRequest, role: UserRole) {
  if (role === 'HR') return null
  if (!process.env.OFFICE_STATIC_IP) return Response.json({ error: 'Office network access is not configured.' }, { status: 503 })
  if (!isOfficeNetwork(request.headers)) {
    return Response.json({ error: 'This action is only available from the registered office network.' }, { status: 403 })
  }
  return null
}