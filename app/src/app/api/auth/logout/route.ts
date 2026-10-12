import { NextRequest, NextResponse } from 'next/server'
import { rejectCrossOriginMutation } from '@/lib/api-security'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginMutation(request)
  if (originError) return originError
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}