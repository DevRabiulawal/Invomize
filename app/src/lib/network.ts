import 'server-only'
import { isIP } from 'node:net'
import type { Headers } from 'next/dist/compiled/@edge-runtime/primitives'

function normalizeIp(value: string | null | undefined) {
  if (!value) return null
  let candidate = value.trim()
  if (candidate.startsWith('[') && candidate.includes(']')) candidate = candidate.slice(1, candidate.indexOf(']'))
  if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7)
  return isIP(candidate) ? candidate.toLowerCase() : null
}

export function resolveClientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return normalizeIp(headers.get('x-real-ip')) ?? normalizeIp(forwardedFor)
}

export function isOfficeNetwork(headers: Headers) {
  const officeIp = normalizeIp(process.env.OFFICE_STATIC_IP ?? null)
  const clientIp = resolveClientIp(headers)
  if (officeIp && clientIp && officeIp === clientIp) return true

  const host = headers.get('host') ?? headers.get('x-forwarded-host') ?? ''
  const normalizedHost = host.split(',')[0].trim().toLowerCase()
  const isLocalhost = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost.startsWith('localhost:') || normalizedHost.startsWith('127.0.0.1:') || normalizedHost === '[::1]' || normalizedHost.startsWith('[::1]:')
  const isLocalOfficeIp = officeIp === '127.0.0.1' || officeIp === '::1'
  return Boolean(isLocalOfficeIp && isLocalhost)
}