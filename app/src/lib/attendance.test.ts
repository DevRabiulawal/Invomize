import { describe, expect, it } from 'vitest'
import { assessCheckIn, countWorkingDays, getLocalShiftClock, secondsFromTime } from './attendance'

describe('attendance business rules', () => {
  it('treats check-in exactly at the grace boundary as on time', () => {
    expect(assessCheckIn(9 * 3600 + 10 * 60, '09:00:00', 10, 5)).toEqual({
      status: 'PRESENT', lateMinutes: 0, penaltyPoints: 0,
    })
    expect(assessCheckIn(9 * 3600 + 10 * 60 + 1, '09:00:00', 10, 5)).toEqual({
      status: 'LATE', lateMinutes: 1, penaltyPoints: 5,
    })
  })

  it('uses the configured local timezone to determine shift date and weekday', () => {
    expect(getLocalShiftClock(new Date('2026-01-05T14:00:00.000Z'), 'America/New_York')).toEqual({
      date: '2026-01-05', secondsSinceMidnight: 32400, isoWeekday: 1,
    })
  })

  it('counts only configured working days in a leave request', () => {
    expect(countWorkingDays('2026-03-06', '2026-03-10', [1, 2, 3, 4, 5])).toBe(3)
    expect(countWorkingDays('2026-03-10', '2026-03-06', [1, 2, 3, 4, 5])).toBe(0)
  })

  it('accepts Postgres time values without allowing invalid shifts', () => {
    expect(secondsFromTime('09:30:15')).toBe(34215)
    expect(() => secondsFromTime('25:00')).toThrow('Shift time is invalid.')
  })
})