import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

const sessionItemSchema = z.object({
  product_id:   z.number().int(),
  barcode:      z.string().default(''),
  sku:          z.string().default(''),
  product_name: z.string(),
  expected_qty: z.number().int().min(0),
  counted_qty:  z.number().int().min(0),
  difference:   z.number().int(),
  status:       z.enum(['ok', 'missing', 'over', 'unchecked']),
})

const createSessionSchema = z.object({
  created_by:   z.string().default(''),
  session_type: z.string().optional(),
  items:        z.array(sessionItemSchema),
})

// POST /inventory/sessions
router.post('/sessions', (req: Request, res: Response) => {
  const parsed = createSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() }); return
  }

  const d = parsed.data
  const total_items   = d.items.length
  const total_ok      = d.items.filter(i => i.status === 'ok').length
  const total_missing = d.items.filter(i => i.status === 'missing').length
  const total_over    = d.items.filter(i => i.status === 'over').length

  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inventory_sessions (created_by, session_type, total_items, total_missing, total_over, total_ok, created_at)
      VALUES (@created_by, @session_type, @total_items, @total_missing, @total_over, @total_ok, @created_at)
    `).run({ created_by: d.created_by, session_type: d.session_type ?? 'products', total_items, total_missing, total_over, total_ok, created_at: nowTH() })

    const session_id = result.lastInsertRowid as number

    const insertItem = db.prepare(`
      INSERT INTO inventory_session_items
        (session_id, product_id, barcode, sku, product_name, expected_qty, counted_qty, difference, status)
      VALUES
        (@session_id, @product_id, @barcode, @sku, @product_name, @expected_qty, @counted_qty, @difference, @status)
    `)

    for (const item of d.items) {
      insertItem.run({ session_id, ...item })
    }

    return session_id
  })

  const session_id = tx()
  const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(session_id)
  res.status(201).json({ success: true, data: session })
})

// GET /inventory/sessions
router.get('/sessions', (req: Request, res: Response) => {
  const { search, from, to } = req.query as Record<string, string>

  let sql = 'SELECT * FROM inventory_sessions WHERE 1=1'
  const params: (string | number)[] = []

  if (search) {
    sql += ` AND (created_by LIKE ? OR CAST(id AS TEXT) LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  if (from) {
    sql += ` AND created_at >= ?`
    params.push(from)
  }
  if (to) {
    sql += ` AND created_at <= ?`
    params.push(to + ' 23:59:59')
  }

  sql += ' ORDER BY created_at DESC'

  const sessions = db.prepare(sql).all(...params)
  res.json({ success: true, data: sessions })
})

// GET /inventory/sessions/:id
router.get('/sessions/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid session ID' }); return }

  const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(id)
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return }

  const items = db.prepare(
    `SELECT * FROM inventory_session_items WHERE session_id = ? ORDER BY
      CASE status WHEN 'missing' THEN 0 WHEN 'over' THEN 1 WHEN 'unchecked' THEN 2 ELSE 3 END,
      product_name`
  ).all(id)

  res.json({ success: true, data: { ...session, items } })
})

// DELETE /inventory/sessions/:id
router.delete('/sessions/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }

  const session = db.prepare('SELECT id FROM inventory_sessions WHERE id = ?').get(id)
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return }

  db.prepare('DELETE FROM inventory_sessions WHERE id = ?').run(id)
  res.json({ success: true })
})

export default router
