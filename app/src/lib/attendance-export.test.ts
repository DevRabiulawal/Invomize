import { describe, expect, it } from 'vitest'
import { buildAttendanceCsv } from './attendance-export'

describe('buildAttendanceCsv', () => {
  it('escapes CSV values and includes checkout times', () => {
    const csv = buildAttendanceCsv([
      {
        employee: 'Ada, Smith',
        email: 'ada@example.com',
        department: 'Engineering',
        date: '2026-10-12',
        checkIn: '09:05',
        checkOut: '17:40',
        status: 'LATE',
        lateMinutes: 5,
        penaltyPoints: 5,
      },
    ])

    expect(csv).toContain('Employee,Email,Department,Date,Check-in,Check-out,Status,Late minutes,Penalty points')
    expect(csv).toContain('"Ada, Smith"')
    expect(csv).toContain('17:40')
  })
})
