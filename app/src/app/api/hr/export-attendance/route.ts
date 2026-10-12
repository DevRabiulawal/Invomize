import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getApiSession } from '@/lib/api-auth'

export async function GET() {
  const auth = await getApiSession('HR')
  if (!auth.ok) return auth.response

  let logsQuery = auth.supabase
    .from('attendance_logs')
    .select('id, user_id, date, checked_in_at, checked_out_at, status, late_minutes, penalty_points')
    .eq('company_id', auth.profile.company_id)
    .order('date', { ascending: false })
    .limit(1000)

  let logsResult: any = await logsQuery
  if (logsResult.error && logsResult.error.code === '42703') {
    logsResult = await auth.supabase
      .from('attendance_logs')
      .select('id, user_id, date, checked_in_at, status, late_minutes, penalty_points')
      .eq('company_id', auth.profile.company_id)
      .order('date', { ascending: false })
      .limit(1000)
  }

  const profilesResult = await auth.supabase
    .from('profiles')
    .select('id, full_name, email, department')
    .eq('company_id', auth.profile.company_id)
    .order('full_name', { ascending: true })

  if (profilesResult.error || logsResult.error) {
    console.error('Attendance export failed', profilesResult.error ?? logsResult.error)
    return NextResponse.json({ error: 'Unable to export attendance information.' }, { status: 500 })
  }

  const people = new Map((profilesResult.data ?? []).map((person) => [person.id, person]))
  const exportRows = (logsResult.data ?? []).map((row: any) => {
    const person = people.get(row.user_id)
    return {
      Employee: person?.full_name ?? 'Unknown employee',
      Email: person?.email ?? 'unknown@company.com',
      Department: person?.department ?? 'Unassigned',
      Date: row.date,
      'Check-in': row.checked_in_at ? new Date(row.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
      'Check-out': 'checked_out_at' in row && row.checked_out_at ? new Date(row.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
      Status: row.status,
      'Late minutes': Number(row.late_minutes ?? 0),
      'Penalty points': Number(row.penalty_points ?? 0),
    }
  })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Attendance')
  worksheet.columns = [
    { header: 'Employee', key: 'Employee', width: 28 },
    { header: 'Email', key: 'Email', width: 32 },
    { header: 'Department', key: 'Department', width: 22 },
    { header: 'Date', key: 'Date', width: 14 },
    { header: 'Check-in', key: 'Check-in', width: 14 },
    { header: 'Check-out', key: 'Check-out', width: 14 },
    { header: 'Status', key: 'Status', width: 14 },
    { header: 'Late minutes', key: 'Late minutes', width: 16 },
    { header: 'Penalty points', key: 'Penalty points', width: 16 },
  ]
  worksheet.addRows(exportRows)
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245C50' } }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = 'A1:I1'
  const workbookBuffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(workbookBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance-export.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
