import { z } from 'zod'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  portal: z.enum(['EMPLOYEE', 'HR']),
})

export const inviteSchema = z.object({
  email: z.email().max(254),
  fullName: z.string().trim().min(1).max(160),
  jobTitle: z.string().trim().max(120).optional().default(''),
  department: z.string().trim().max(120).optional().default(''),
})

export const shiftConfigSchema = z.object({
  shiftStart: z.string().regex(timePattern),
  shiftEnd: z.string().regex(timePattern),
  graceMinutes: z.number().int().min(0).max(240),
  latePenaltyPoints: z.number().int().min(0).max(100),
  maxDailyBase: z.number().positive().max(100000),
  timeZone: z.string().trim().min(1).max(64),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
}).refine((value) => value.shiftEnd > value.shiftStart, {
  message: 'Shift end must be after shift start.',
  path: ['shiftEnd'],
}).refine((value) => new Set(value.workingDays).size === value.workingDays.length, {
  message: 'Working days cannot contain duplicates.',
  path: ['workingDays'],
}).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); return true } catch { return false }
}, { message: 'Time zone must be an IANA time zone.', path: ['timeZone'] })

export const leaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: z.string().regex(datePattern),
  endDate: z.string().regex(datePattern),
  reason: z.string().trim().min(2).max(2000),
}).refine((value) => value.endDate >= value.startDate, {
  message: 'End date must be on or after start date.',
  path: ['endDate'],
})

export const leaveDecisionSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(['APPROVED', 'DECLINED']),
})