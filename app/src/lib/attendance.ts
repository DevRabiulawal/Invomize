import type { AttendanceStatus } from './database.types'

export type LocalShiftClock = {
  date: string
  secondsSinceMidnight: number
  isoWeekday: number
}

export function getLocalShiftClock(timestamp: Date, timeZone: string): LocalShiftClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const date = `${values.year}-${values.month}-${values.day}`
  const hour = Number(values.hour)
  const minute = Number(values.minute)
  const second = Number(values.second)
  const utcWeekday = new Date(`${date}T00:00:00Z`).getUTCDay()

  return {
    date,
    secondsSinceMidnight: hour * 3600 + minute * 60 + second,
    isoWeekday: utcWeekday === 0 ? 7 : utcWeekday,
  }
}

export function secondsFromTime(time: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!match) throw new Error('Shift time must be in HH:mm or HH:mm:ss format.')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) throw new Error('Shift time is invalid.')
  return hours * 3600 + minutes * 60 + seconds
}

export function assessCheckIn(localSeconds: number, shiftStart: string, graceMinutes: number, penaltyPoints: number) {
  const lateBySeconds = localSeconds - (secondsFromTime(shiftStart) + graceMinutes * 60)
  const late = lateBySeconds > 0
  return {
    status: (late ? 'LATE' : 'PRESENT') as Extract<AttendanceStatus, 'LATE' | 'PRESENT'>,
    lateMinutes: late ? Math.ceil(lateBySeconds / 60) : 0,
    penaltyPoints: late ? penaltyPoints : 0,
  }
}

export function countWorkingDays(startDate: string, endDate: string, workingDays: number[]) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0
  let count = 0
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const utcDay = cursor.getUTCDay()
    const isoWeekday = utcDay === 0 ? 7 : utcDay
    if (workingDays.includes(isoWeekday)) count += 1
    if (count > 90) break
  }
  return count
}