import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { findEmployeeByUsername } from '../services/sheetsService'
import { signToken, verifyToken } from '../utils/jwt'
import { requireAuth } from '../middleware/requireAuth'
import db from '../db/database'
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie'

const router = Router()

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

function sessionExpiresAtFromTokenUser(user: { exp?: number }) {
  return user.exp
    ? new Date(user.exp * 1000).toISOString()
    : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
}

function authSuccessPayload(token: string, user: Record<string, any>) {
  const payload = verifyToken(token)
  return {
    success: true,
    session_expires_at: sessionExpiresAtFromTokenUser(payload),
    user,
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.errors[0].message,
    })
  }

  const { username, password } = parsed.data

  try {
    // Check local users table first
    const localUser = db.prepare(
      `SELECT * FROM users WHERE username = ?`
    ).get(username) as Record<string, any> | undefined

    if (localUser) {
      if (localUser.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Your account is inactive. Please contact your administrator.' })
      }
      const isValid = await bcrypt.compare(password, localUser.password_hash as string)
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid username or password' })
      }
      const token = signToken({
        staff_id:   String(localUser.id),
        user:       localUser.username as string,
        role:       localUser.role as 'admin' | 'staff',
        first_name: localUser.first_name as string,
        last_name:  localUser.last_name as string,
        nickname:   localUser.nickname as string,
      })
      const user = {
        staff_id:   String(localUser.id),
        user:       localUser.username,
        first_name: localUser.first_name,
        last_name:  localUser.last_name,
        nickname:   localUser.nickname,
        role:       localUser.role,
        phone_no:   localUser.phone_no,
      }
      setAuthCookie(res, token)
      return res.json(authSuccessPayload(token, user))
    }

    // Fallback to Google Apps Script (existing behavior)
    const employee = await findEmployeeByUsername(username)

    if (!employee || !employee.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' })
    }

    if (employee.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Your account is inactive. Please contact your administrator.',
      })
    }

    const isValid = await bcrypt.compare(password, employee.password_hash)
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' })
    }

    const token = signToken({
      staff_id:   employee.staff_id,
      user:       employee.user,
      role:       employee.role,
      first_name: employee.first_name,
      last_name:  employee.last_name,
      nickname:   employee.nickname,
    })

    const user = {
      staff_id:   employee.staff_id,
      user:       employee.user,
      first_name: employee.first_name,
      last_name:  employee.last_name,
      nickname:   employee.nickname,
      role:       employee.role,
      phone_no:   employee.phone_no,
    }
    setAuthCookie(res, token)
    return res.json(authSuccessPayload(token, user))
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again.' })
  }
})

// GET /api/auth/me  — verify token and return current user
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
    session_expires_at: sessionExpiresAtFromTokenUser(req.user ?? {}),
  })
})

// POST /api/auth/refresh  — issue a new token from a valid existing token
router.post('/refresh', requireAuth, (req, res) => {
  const u = req.user!
  const token = signToken({
    staff_id:   u.staff_id,
    user:       u.user,
    role:       u.role,
    first_name: u.first_name,
    last_name:  u.last_name,
    nickname:   u.nickname,
  })
  setAuthCookie(res, token)
  return res.json(authSuccessPayload(token, u))
})

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  return res.json({ success: true })
})

export default router
