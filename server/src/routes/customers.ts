import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

function nextCustomerId(): string {
  const row = db.prepare("SELECT customer_id FROM customers ORDER BY customer_id DESC LIMIT 1").get() as any
  if (!row) return '000001'
  const max = parseInt(row.customer_id, 10)
  return String(max + 1).padStart(6, '0')
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
})

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const search = String(req.query.search ?? '')
  const rows = search
    ? db.prepare(`
        SELECT * FROM customers
        WHERE first_name LIKE ? OR last_name LIKE ? OR phone_no LIKE ?
        ORDER BY created_at DESC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`)
    : db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all()

  res.json({ success: true, data: rows })
})

// ── Get one ──────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
  if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return }
  res.json({ success: true, data: customer })
})

// ── Create ───────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const parsed = customerSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const customer_id = nextCustomerId()

  db.prepare(`
    INSERT INTO customers (customer_id, first_name, last_name, phone_no, email, birthday, gender, address, note, source, created_at)
    VALUES (@customer_id, @first_name, @last_name, @phone_no, @email, @birthday, @gender, @address, @note, @source, @created_at)
  `).run({ customer_id, ...d, created_at: nowTH() })

  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customer_id)
  res.status(201).json({ success: true, data: customer })
})

// ── Update ───────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ success: false, error: 'Customer not found' }); return }

  const parsed = customerSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const fields = parsed.data
  if (Object.keys(fields).length === 0) { res.status(400).json({ success: false, error: 'No fields to update' }); return }

  const setClauses = Object.keys(fields).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE customers SET ${setClauses} WHERE customer_id = @customer_id`)
    .run({ ...fields, customer_id: req.params.id })

  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
  res.json({ success: true, data: customer })
})

// ── Delete (cascades purchases) ───────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ success: false, error: 'Customer not found' }); return }
  db.prepare('DELETE FROM customers WHERE customer_id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
