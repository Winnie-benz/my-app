import type { Request, Response } from 'express'
import { TOKEN_EXPIRES_IN_MS } from './jwt'

export const AUTH_COOKIE_NAME = 'owndays_session'

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const idx = part.indexOf('=')
      if (idx === -1) return acc
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (!key) return acc
      acc[key] = decodeURIComponent(value)
      return acc
    }, {})
}

export function readAuthToken(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie)
  return cookies[AUTH_COOKIE_NAME] || null
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_EXPIRES_IN_MS,
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}
