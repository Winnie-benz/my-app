import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'
import { recordAuditLog } from '../services/auditLog'

const router = Router()
router.use(requireAuth)

function nextCustomerId(): string {
  const row = db.prepare("SELECT customer_id FROM customers ORDER BY customer_id DESC LIMIT 1").get() as any
  if (!row) return '000001'
  const max = parseInt(row.customer_id, 10)
  return String(max + 1).padStart(6, '0')
}

function actorDisplayName(req: Request): string {
  const user = req.user
  if (!user) return ''
  return [user.nickname || user.first_name, user.last_name].filter(Boolean).join(' ') || user.user
}

const customerSchema = z.object({
  first_name: z.string().min(1),
  last_name:  z.string().min(1),
  phone_no:   z.string().default(''),
  email:      z.string().default(''),
  birthday:   z.string().default(''),
  gender:     z.enum(['male', 'female', 'unspecified']).default('unspecified'),
  address:    z.string().default(''),
  note:       z.string().default(''),
  source:     z.enum(['walk_in', 'referral', 'social_media', 'other']).default('walk_in'),
  occupation: z.string().max(100).default(''),
})

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const search = String(req.query.search ?? '')
  const rows = search
    ? db.prepare(`
        SELECT * FROM customers
        WHERE COALESCE(deleted_at, '') = ''
          AND (first_name LIKE ? OR last_name LIKE ? OR phone_no LIKE ?)
        ORDER BY created_at DESC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`)
    : db.prepare("SELECT * FROM customers WHERE COALESCE(deleted_at, '') = '' ORDER BY created_at DESC").all()

  res.json({ success: true, data: rows })
})

router.get('/deleted', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM customers
    WHERE COALESCE(deleted_at, '') <> ''
    ORDER BY deleted_at DESC, customer_id DESC
  `).all()

  res.json({ success: true, data: rows })
})

// ── Get one ──────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const customer = db.prepare("SELECT * FROM customers WHERE customer_id = ? AND COALESCE(deleted_at, '') = ''").get(req.params.id)
  if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return }
  res.json({ success: true, data: customer })
})

// ── Create ───────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const parsed = customerSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const customer_id = nextCustomerId()

  const customer = db.transaction(() => {
    db.prepare(`
      INSERT INTO customers (customer_id, first_name, last_name, phone_no, email, birthday, gender, address, note, source, occupation, created_at)
      VALUES (@customer_id, @first_name, @last_name, @phone_no, @email, @birthday, @gender, @address, @note, @source, @occupation, @created_at)
    `).run({ customer_id, ...d, created_at: nowTH() })

    const created = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customer_id)
    recordAuditLog(req, 'customer', customer_id, 'create', null, created)
    return created
  })()
  res.status(201).json({ success: true, data: customer })
})

// ── Update ───────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare("SELECT * FROM customers WHERE customer_id = ? AND COALESCE(deleted_at, '') = ''").get(req.params.id)
  if (!existing) { res.status(404).json({ success: false, error: 'Customer not found' }); return }

  const parsed = customerSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const fields = parsed.data
  if (Object.keys(fields).length === 0) { res.status(400).json({ success: false, error: 'No fields to update' }); return }

  const setClauses = Object.keys(fields).map(k => `${k} = @${k}`).join(', ')
  const customer = db.transaction(() => {
    db.prepare(`UPDATE customers SET ${setClauses} WHERE customer_id = @customer_id`)
      .run({ ...fields, customer_id: req.params.id })

    const updated = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
    recordAuditLog(req, 'customer', req.params.id, 'update', existing, updated)
    return updated
  })()
  res.json({ success: true, data: customer })
})

// ── Delete (soft delete; purchase history stays intact) ───────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare("SELECT * FROM customers WHERE customer_id = ? AND COALESCE(deleted_at, '') = ''").get(req.params.id)
  if (!existing) { res.status(404).json({ success: false, error: 'Customer not found' }); return }
  db.transaction(() => {
    db.prepare('UPDATE customers SET deleted_at = ?, deleted_by = ? WHERE customer_id = ?')
      .run(nowTH(), actorDisplayName(req), req.params.id)
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
    recordAuditLog(req, 'customer', req.params.id, 'delete', existing, customer)
  })()
  res.json({ success: true })
})

router.post('/:id/restore', requireAdmin, (req: Request, res: Response) => {
  const existing = db.prepare("SELECT * FROM customers WHERE customer_id = ? AND COALESCE(deleted_at, '') <> ''").get(req.params.id)
  if (!existing) { res.status(404).json({ success: false, error: 'Deleted customer not found' }); return }

  const customer = db.transaction(() => {
    db.prepare("UPDATE customers SET deleted_at = '', deleted_by = '' WHERE customer_id = ?").run(req.params.id)
    const restored = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
    recordAuditLog(req, 'customer', req.params.id, 'restore', existing, restored)
    return restored
  })()
  res.json({ success: true, data: customer })
})

export default router
