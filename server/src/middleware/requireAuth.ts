import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import type { JWTPayload } from '../types'
import { readAuthToken } from '../utils/authCookie'

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null
  const cookieToken = readAuthToken(req)
  const token = bearerToken || cookieToken

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    req.user = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' })
    return
  }
  next()
}
