import jwt from 'jsonwebtoken'
import type { JWTPayload } from '../types'

const secret = process.env.JWT_SECRET
if (!secret) throw new Error('JWT_SECRET environment variable is required')

// Parse env string like "8h", "30m", "1d" → seconds (number avoids branded StringValue type issue)
function parseExpiry(str: string): number {
  const match = str.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return 8 * 3600
  const n = Number(match[1])
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return n * multipliers[match[2]]
}

const EXPIRES_IN_SEC = parseExpiry(process.env.JWT_EXPIRES_IN ?? '8h')
export const TOKEN_EXPIRES_IN_SEC = EXPIRES_IN_SEC
export const TOKEN_EXPIRES_IN_MS = EXPIRES_IN_SEC * 1000

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, secret as string, { expiresIn: EXPIRES_IN_SEC })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, secret as string) as JWTPayload
}
