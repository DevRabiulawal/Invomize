export type AttendanceExportRow = {
  employee: string
  email: string
  department: string
  date: string
  checkIn: string
  checkOut: string
  status: string
  lateMinutes: number
  penaltyPoints: number
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildAttendanceCsv(rows: AttendanceExportRow[]) {
  const headers = ['Employee', 'Email', 'Department', 'Date', 'Check-in', 'Check-out', 'Status', 'Late minutes', 'Penalty points']
  const lines = [headers, ...rows.map((row) => [
    row.employee,
    row.email,
    row.department,
    row.date,
    row.checkIn,
    row.checkOut,
    row.status,
    row.lateMinutes,
    row.penaltyPoints,
  ].map(escapeCsvValue))]

  return `${lines.map((line) => line.join(',')).join('\n')}\n`
}
