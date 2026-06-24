import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'
import { recordAuditLog } from '../services/auditLog'

const router = Router()
router.use(requireAuth)

function actorDisplayName(req: Request): string {
  const user = req.user
  if (!user) return ''
  return [user.nickname || user.first_name, user.last_name].filter(Boolean).join(' ') || user.user
}

function calcAvgCost(oldStock: number, oldAvg: number, newQty: number, newCost: number): number {
  const total = oldStock + newQty
  if (total === 0) return 0
  return (oldStock * oldAvg + newQty * newCost) / total
}

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM products WHERE COALESCE(deleted_at, '') = '' ORDER BY name ASC").all()
  res.json({ success: true, data: rows })
})

// ── Smart search for sales autocomplete ─────────────────────────────────────
router.get('/search', (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) {
    res.json({ success: true, data: [] })
    return
  }

  const like = `%${q}%`
  const rows = db.prepare(`
    SELECT *
    FROM products
    WHERE COALESCE(deleted_at, '') = ''
      AND (
        barcode = ?
        OR barcode LIKE ?
        OR sku LIKE ?
        OR name LIKE ?
      )
    ORDER BY
      CASE
        WHEN barcode = ? THEN 0
        WHEN barcode LIKE ? THEN 1
        WHEN sku LIKE ? THEN 2
        ELSE 3
      END,
      name ASC
    LIMIT 12
  `).all(q, like, like, like, q, like, like)

  res.json({ success: true, data: rows })
})

router.get('/deleted', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM products
    WHERE COALESCE(deleted_at, '') <> ''
    ORDER BY deleted_at DESC, id DESC
  `).all()
  res.json({ success: true, data: rows })
})

// ── Get one ──────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(Number(req.params.id))
  if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return }
  res.json({ success: true, data: product })
})

// ── Create / Stock-in if barcode exists ──────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const schema = z.object({
    barcode:        z.string().min(1),
    sku:            z.string().default(''),
    name:           z.string().min(1),
    category:       z.string().default('อุปกรณ์อื่นๆ'),
    cost_price:     z.number().min(0),
    sell_price:     z.number().min(0),
    stock_current:  z.number().int().min(0),
    note:           z.string().default(''),
    reorder_point:  z.number().int().min(0).default(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const existing = db.prepare('SELECT * FROM products WHERE barcode = ?').get(d.barcode) as any

  if (existing) {
    if (existing.deleted_at) {
      res.status(409).json({ success: false, error: 'สินค้านี้อยู่ในรายการที่ถูกลบ กรุณากู้คืนจากหน้า Settings ก่อน' })
      return
    }
    const newAvg   = calcAvgCost(existing.stock_current, existing.avg_cost, d.stock_current, d.cost_price)
    const newStock = existing.stock_current + d.stock_current
    const updated = db.transaction(() => {
      db.prepare('UPDATE products SET stock_current = ?, avg_cost = ? WHERE id = ?')
        .run(newStock, newAvg, existing.id)
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id)
      recordAuditLog(req, 'product', String(existing.id), 'update', existing, row)
      return row
    })()
    res.json({ success: true, data: updated, stockIn: true, added: d.stock_current, newAvg })
    return
  }

  const product = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO products (barcode, sku, name, category, cost_price, sell_price, stock_current, avg_cost, note, reorder_point, created_at)
      VALUES (@barcode, @sku, @name, @category, @cost_price, @sell_price, @stock_current, @avg_cost, @note, @reorder_point, @created_at)
    `).run({ ...d, avg_cost: d.cost_price, created_at: nowTH() })

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)
    recordAuditLog(req, 'product', String(result.lastInsertRowid), 'create', null, row)
    return row
  })()
  res.status(201).json({ success: true, data: product })
})

// ── Update ───────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id) as any
  if (!existing) { res.status(404).json({ success: false, error: 'Product not found' }); return }

  const schema = z.object({
    barcode:       z.string().min(1).optional(),
    sku:           z.string().optional(),
    name:          z.string().min(1).optional(),
    category:      z.string().optional(),
    cost_price:    z.number().min(0).optional(),
    sell_price:    z.number().min(0).optional(),
    stock_current: z.number().int().min(0).optional(),
    note:          z.string().optional(),
    reorder_point: z.number().int().min(0).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const fields = parsed.data
  if (Object.keys(fields).length === 0) { res.status(400).json({ success: false, error: 'No fields to update' }); return }

  if (fields.barcode && fields.barcode !== existing.barcode) {
    const dup = db.prepare("SELECT id, deleted_at FROM products WHERE barcode = ? AND id <> ?").get(fields.barcode, id) as any
    if (dup?.deleted_at) {
      res.status(409).json({ success: false, error: 'barcode นี้อยู่ในสินค้าที่ถูกลบ กรุณากู้คืนหรือเปลี่ยน barcode ก่อน' })
      return
    }
  }

  const setClauses = Object.keys(fields).map(k => `${k} = @${k}`).join(', ')
  const product = db.transaction(() => {
    db.prepare(`UPDATE products SET ${setClauses} WHERE id = @id`).run({ ...fields, id })
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    recordAuditLog(req, 'product', String(id), 'update', existing, row)
    return row
  })()
  res.json({ success: true, data: product })
})

// ── Delete ───────────────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id)
  if (!existing) { res.status(404).json({ success: false, error: 'Product not found' }); return }
  db.transaction(() => {
    db.prepare('UPDATE products SET deleted_at = ?, deleted_by = ? WHERE id = ?')
      .run(nowTH(), actorDisplayName(req), id)
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    recordAuditLog(req, 'product', String(id), 'delete', existing, row)
  })()
  res.json({ success: true })
})

router.post('/:id/restore', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') <> ''").get(id) as any
  if (!existing) { res.status(404).json({ success: false, error: 'Deleted product not found' }); return }

  const barcodeConflict = db.prepare("SELECT id FROM products WHERE barcode = ? AND COALESCE(deleted_at, '') = '' AND id <> ?").get(existing.barcode, id) as any
  if (barcodeConflict) {
    res.status(409).json({ success: false, error: 'ไม่สามารถกู้คืนได้ เพราะมีสินค้า active ใช้ barcode นี้อยู่แล้ว' })
    return
  }

  const product = db.transaction(() => {
    db.prepare("UPDATE products SET deleted_at = '', deleted_by = '' WHERE id = ?").run(id)
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    recordAuditLog(req, 'product', String(id), 'restore', existing, row)
    return row
  })()
  res.json({ success: true, data: product })
})

// ── Low-stock alert dismissal ────────────────────────────────────────────────
// POST { ignored?: boolean } — hide/show a product in the low-stock alert (default: hide)
router.post('/:id/low-stock-ignore', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const ignored = req.body?.ignored === false ? 0 : 1
  const existing = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id)
  if (!existing) { res.status(404).json({ success: false, error: 'Product not found' }); return }
  db.prepare('UPDATE products SET low_stock_ignored = ? WHERE id = ?').run(ignored, id)
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

// ── Stock In ─────────────────────────────────────────────────────────────────
router.post('/:id/stock-in', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const product = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id) as any
  if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return }

  const schema = z.object({ qty: z.number().int().min(1), cost: z.number().min(0) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const { qty, cost } = parsed.data
  const newAvg   = calcAvgCost(product.stock_current, product.avg_cost, qty, cost)
  const newStock = product.stock_current + qty

  db.transaction(() => {
    db.prepare('UPDATE products SET stock_current = ?, avg_cost = ? WHERE id = ?').run(newStock, newAvg, id)
    db.prepare(`INSERT INTO stock_movements (product_id, type, qty, cost, created_at) VALUES (?, 'stock_in', ?, ?, ?)`).run(id, qty, cost, nowTH())
  })()

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

// ── Stock Out (manual — adjusts avg_cost for corrections) ────────────────────
router.post('/:id/stock-out', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const product = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id) as any
  if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return }

  const schema = z.object({ qty: z.number().int().min(1), cost: z.number().min(0) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const { qty, cost } = parsed.data
  const newStock = Math.max(0, product.stock_current - qty)
  const newAvg   = newStock > 0
    ? Math.max(0, (product.stock_current * product.avg_cost - qty * cost) / newStock)
    : 0

  db.transaction(() => {
    db.prepare('UPDATE products SET stock_current = ?, avg_cost = ? WHERE id = ?').run(newStock, newAvg, id)
    db.prepare(`INSERT INTO stock_movements (product_id, type, qty, cost, created_at) VALUES (?, 'stock_out', ?, ?, ?)`).run(id, -qty, cost, nowTH())
  })()

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

// ── Deduct (legacy manual endpoint) ──────────────────────────────────────────
router.post('/:id/deduct', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const product = db.prepare("SELECT * FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id) as any
  if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return }

  const schema = z.object({ qty: z.number().int().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const newStock = Math.max(0, product.stock_current - parsed.data.qty)
  db.transaction(() => {
    db.prepare('UPDATE products SET stock_current = ? WHERE id = ?').run(newStock, id)
    db.prepare(`INSERT INTO stock_movements (product_id, type, qty, created_at) VALUES (?, 'sale', ?, ?)`).run(id, -parsed.data.qty, nowTH())
  })()

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

// ── Movement History ──────────────────────────────────────────────────────────
router.get('/:id/movements', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const product = db.prepare("SELECT id FROM products WHERE id = ? AND COALESCE(deleted_at, '') = ''").get(id)
  if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return }

  const rows = db.prepare(
    'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 100'
  ).all(id)
  res.json({ success: true, data: rows })
})

export default router
