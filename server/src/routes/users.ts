import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/requireAuth'

const router = Router()

const UserCreateSchema = z.object({
  username:   z.string().min(1),
  password:   z.string().min(6, 'Password must be at least 6 characters'),
  role:       z.enum(['admin', 'staff']).default('staff'),
  first_name: z.string().min(1),
  last_name:  z.string().default(''),
  nickname:   z.string().default(''),
  phone_no:   z.string().default(''),
})

const UserUpdateSchema = z.object({
  role:       z.enum(['admin', 'staff']).optional(),
  first_name: z.string().min(1).optional(),
  last_name:  z.string().optional(),
  nickname:   z.string().optional(),
  phone_no:   z.string().optional(),
  status:     z.enum(['active', 'inactive']).optional(),
  password:   z.string().min(6).optional(),
})

// GET /api/users
router.get('/', requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare(
    `SELECT id, username, role, first_name, last_name, nickname, phone_no, status, created_at
     FROM users ORDER BY created_at DESC`
  ).all()
  return res.json({ success: true, data: users })
})

// POST /api/users
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = UserCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors[0].message })
  }
  const { username, password, role, first_name, last_name, nickname, phone_no } = parsed.data

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already exists' })
  }

  const password_hash = await bcrypt.hash(password, 12)
  const result = db.prepare(
    `INSERT INTO users (username, password_hash, role, first_name, last_name, nickname, phone_no)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(username, password_hash, role, first_name, last_name, nickname, phone_no)

  return res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
})

// PATCH /api/users/:id
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = UserUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors[0].message })
  }

  const { password, ...fields } = parsed.data
  const updates: string[] = []
  const values: any[] = []

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { updates.push(`${k} = ?`); values.push(v) }
  }

  if (password) {
    updates.push('password_hash = ?')
    values.push(await bcrypt.hash(password, 12))
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' })
  }

  values.push(id)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  return res.json({ success: true })
})

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return res.json({ success: true })
})

export default router
