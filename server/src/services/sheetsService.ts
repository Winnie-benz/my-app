import type { Employee } from '../types'

const SCRIPT_URL   = process.env.APPS_SCRIPT_URL
const SCRIPT_TOKEN = process.env.APPS_SCRIPT_TOKEN

if (!SCRIPT_URL)   throw new Error('APPS_SCRIPT_URL environment variable is required')
if (!SCRIPT_TOKEN) throw new Error('APPS_SCRIPT_TOKEN environment variable is required')

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface Cache {
  data: Employee
  expiresAt: number
  username: string
}

// Per-username cache — avoids redundant script calls within TTL
const cache = new Map<string, Cache>()

function buildUrl(params: Record<string, string>): string {
  const url = new URL(SCRIPT_URL as string)
  url.searchParams.set('token', SCRIPT_TOKEN as string)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

export async function findEmployeeByUsername(username: string): Promise<Employee | null> {
  const now = Date.now()
  const hit  = cache.get(username)
  if (hit && now < hit.expiresAt) return hit.data

  const url      = buildUrl({ action: 'getEmployee', username })
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Apps Script returned HTTP ${response.status}`)
  }

  const body = await response.json() as { success: boolean; employee?: Employee; error?: string }

  if (!body.success) {
    if (body.error === 'Employee not found') return null
    throw new Error(`Apps Script error: ${body.error}`)
  }

  const employee = body.employee as Employee
  cache.set(username, { data: employee, expiresAt: now + CACHE_TTL, username })
  return employee
}

export function clearCache(username?: string): void {
  if (username) cache.delete(username)
  else cache.clear()
}
