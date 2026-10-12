import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Server-side Supabase secret configuration is missing.')

  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}