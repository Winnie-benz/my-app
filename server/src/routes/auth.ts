import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { findEmployeeByUsername } from '../services/sheetsService'
import { signToken } from '../utils/jwt'
import { requireAuth } from '../middleware/requireAuth'
import db from '../db/database'

const router = Router()

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

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
      return res.json({
        success: true,
        token,
        user: {
          staff_id:   String(localUser.id),
          user:       localUser.username,
          first_name: localUser.first_name,
          last_name:  localUser.last_name,
          nickname:   localUser.nickname,
          role:       localUser.role,
          phone_no:   localUser.phone_no,
        },
      })
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

    return res.json({
      success: true,
      token,
      user: {
        staff_id:   employee.staff_id,
        user:       employee.user,
        first_name: employee.first_name,
        last_name:  employee.last_name,
        nickname:   employee.nickname,
        role:       employee.role,
        phone_no:   employee.phone_no,
      },
    })
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    return res.status(500).json({ success: false, error: 'Internal server error. Please try again.' })
  }
})

// GET /api/auth/me  — verify token and return current user
router.get('/me', requireAuth, (req, res) => {
  return res.json({ success: true, user: req.user })
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
  return res.json({ success: true, token })
})

export default router
