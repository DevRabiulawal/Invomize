import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { appendToGoogleSheet } from '@/lib/googleSheets'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function isAuthorized(request: NextRequest) {
  const secret = process.env.SHEETS_SYNC_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || !supplied) return false
  const expectedBytes = Buffer.from(secret)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let limit = 50
  try {
    const body = await request.json() as { limit?: unknown }
    if (typeof body.limit === 'number' && Number.isInteger(body.limit)) limit = Math.max(1, Math.min(100, body.limit))
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  try {
    const admin = createSupabaseAdminClient()
    const { data: rows, error } = await admin.from('attendance_logs')
      .select('id, user_id, date, checked_in_at, status, penalty_points, sheets_sync_attempts')
      .is('sheets_synced_at', null)
      .lt('sheets_sync_attempts', 10)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw error

    const userIds = [...new Set((rows ?? []).map((row) => row.user_id))]
    const { data: profiles, error: profilesError } = userIds.length
      ? await admin.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [], error: null }
    if (profilesError) throw profilesError
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

    let synced = 0
    let failed = 0
    for (const row of rows ?? []) {
      const profile = profilesById.get(row.user_id)
      try {
        if (!profile) throw new Error('Attendance owner profile was not found.')
        await appendToGoogleSheet({
          date: row.date,
          fullName: profile.full_name,
          email: profile.email,
          checkInTime: new Date(row.checked_in_at).toISOString(),
          status: row.status === 'LATE' ? 'LATE' : 'PRESENT',
          penaltyPoints: row.penalty_points,
        })
        await admin.from('attendance_logs').update({
          sheets_synced_at: new Date().toISOString(),
          sheets_sync_attempts: row.sheets_sync_attempts + 1,
          sheets_last_error: null,
        }).eq('id', row.id)
        synced += 1
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message.slice(0, 500) : 'Google Sheets sync failed.'
        await admin.from('attendance_logs').update({
          sheets_sync_attempts: row.sheets_sync_attempts + 1,
          sheets_last_error: message,
        }).eq('id', row.id)
        failed += 1
      }
    }
    return NextResponse.json({ scanned: rows?.length ?? 0, synced, failed }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Attendance Sheets sync batch failed', error)
    return NextResponse.json({ error: 'Unable to run the Sheets sync batch.' }, { status: 500 })
  }
}