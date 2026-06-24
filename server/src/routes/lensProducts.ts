import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

const productSchema = z.object({
  brand:        z.string().default(''),
  series:       z.string().default(''),
  lens_type:    z.string().default(''),
  lens_index:   z.string().default(''),
  coating:      z.string().default(''),
  note:         z.string().default(''),
  default_cost: z.number().min(0).default(0),
  sell_price:   z.number().min(0).default(0),
  sph_min:      z.number().default(-6.0),
  sph_max:      z.number().default(0.0),
  cyl_min:      z.number().default(-2.0),
  cyl_max:      z.number().default(0.0),
  sph_step:     z.number().default(0.25),
  cyl_step:     z.number().default(0.25),
})

function withCounts(row: any) {
  const counts = db.prepare(
    'SELECT COUNT(*) as variant_count, COALESCE(SUM(stock_qty),0) as total_stock FROM lens_variants WHERE product_id = ?'
  ).get(row.id) as { variant_count: number; total_stock: number }
  return { ...row, variant_count: counts.variant_count, total_stock: counts.total_stock }
}

function autoSKU(product: any, sph: string, cyl: string): string {
  const brand = product.brand.replace(/\s+/g, '').toUpperCase().slice(0, 3) || 'LNS'
  const index = (product.lens_index || '').replace('.', '') || 'XX'
  const coating = (product.coating || 'XX').replace(/\s+/g, '').toUpperCase().slice(0, 2)
  const sphNum = Math.round(parseFloat(sph) * 100)
  const cylNum = Math.round(Math.abs(parseFloat(cyl)) * 100)
  const sphStr = (sphNum >= 0 ? 'P' : 'M') + Math.abs(sphNum).toString().padStart(3, '0')
  const cylStr = 'C' + cylNum.toString().padStart(3, '0')
  return `${brand}-${index}-${coating}-${sphStr}-${cylStr}`
}

// GET /lens-products
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM lens_products ORDER BY brand, series').all()
  res.json({ success: true, data: rows.map(withCounts) })
})

// POST /lens-products
router.post('/', (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }
  const d = parsed.data
  try {
    const result = db.prepare(`
      INSERT INTO lens_products (brand, series, lens_type, lens_index, coating, note, default_cost, sell_price, sph_min, sph_max, cyl_min, cyl_max, sph_step, cyl_step, created_at)
      VALUES (@brand, @series, @lens_type, @lens_index, @coating, @note, @default_cost, @sell_price, @sph_min, @sph_max, @cyl_min, @cyl_max, @sph_step, @cyl_step, @created_at)
    `).run({ ...d, created_at: nowTH() })
    const row = db.prepare('SELECT * FROM lens_products WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ success: true, data: withCounts(row) })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Database error' })
  }
})

// PUT /lens-products/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }
  const d = parsed.data
  try {
    db.prepare(`
      UPDATE lens_products
      SET brand=@brand, series=@series, lens_type=@lens_type, lens_index=@lens_index,
          coating=@coating, note=@note, default_cost=@default_cost, sell_price=@sell_price,
          sph_min=@sph_min, sph_max=@sph_max, cyl_min=@cyl_min, cyl_max=@cyl_max,
          sph_step=@sph_step, cyl_step=@cyl_step
      WHERE id=@id
    `).run({ ...d, id })
    const row = db.prepare('SELECT * FROM lens_products WHERE id = ?').get(id)
    if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return }
    res.json({ success: true, data: withCounts(row) })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Database error' })
  }
})

// DELETE /lens-products/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  db.prepare('DELETE FROM lens_products WHERE id = ?').run(id)
  res.json({ success: true })
})

// GET /lens-products/variant-lookup?ids=1,2 — fetch specific variants with their product_id
router.get('/variant-lookup', (req: Request, res: Response) => {
  const ids = String(req.query.ids ?? '').split(',').map(Number).filter(n => !isNaN(n) && n > 0)
  if (ids.length === 0) { res.json({ success: true, data: [] }); return }
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT lv.*, lp.id as lens_product_id FROM lens_variants lv
     JOIN lens_products lp ON lp.id = lv.product_id
     WHERE lv.id IN (${placeholders})`
  ).all(...ids)
  res.json({ success: true, data: rows })
})

// GET /lens-products/zero-stock — variants with stock_qty = 0 (excluding ones dismissed from alert)
router.get('/zero-stock', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT lv.*, lp.brand, lp.series, lp.lens_type, lp.lens_index, lp.coating
    FROM lens_variants lv
    JOIN lens_products lp ON lp.id = lv.product_id
    WHERE lv.stock_qty = 0 AND COALESCE(lv.low_stock_ignored, 0) = 0
    ORDER BY lp.brand, lp.series, CAST(lv.sph AS REAL) DESC, CAST(lv.cyl AS REAL) DESC
  `).all()
  res.json({ success: true, data: rows })
})

// GET /lens-products/low-stock-ignored — zero-stock variants dismissed from the alert
router.get('/low-stock-ignored', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT lv.*, lp.brand, lp.series, lp.lens_type, lp.lens_index, lp.coating
    FROM lens_variants lv
    JOIN lens_products lp ON lp.id = lv.product_id
    WHERE lv.stock_qty = 0 AND COALESCE(lv.low_stock_ignored, 0) = 1
    ORDER BY lp.brand, lp.series, CAST(lv.sph AS REAL) DESC, CAST(lv.cyl AS REAL) DESC
  `).all()
  res.json({ success: true, data: rows })
})

// POST /lens-products/variants/:variantId/low-stock-ignore { ignored?: boolean } — hide/show a variant in the alert (default: hide)
router.post('/variants/:variantId/low-stock-ignore', (req: Request, res: Response) => {
  const id = parseInt(req.params.variantId)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const ignored = req.body?.ignored === false ? 0 : 1
  const existing = db.prepare('SELECT id FROM lens_variants WHERE id = ?').get(id)
  if (!existing) { res.status(404).json({ success: false, error: 'Variant not found' }); return }
  db.prepare('UPDATE lens_variants SET low_stock_ignored = ? WHERE id = ?').run(ignored, id)
  const row = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

// GET /lens-products/:id/variants
router.get('/:id/variants', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const variants = db.prepare('SELECT * FROM lens_variants WHERE product_id = ? ORDER BY CAST(sph AS REAL) DESC, CAST(cyl AS REAL) DESC').all(id)
  res.json({ success: true, data: variants })
})

// PATCH /lens-products/:id/cell  — upsert a single matrix cell
router.patch('/:id/cell', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const { sph, cyl, stock_qty, cost } = req.body
  if (typeof sph !== 'string' || typeof cyl !== 'string' || typeof stock_qty !== 'number') {
    res.status(400).json({ success: false, error: 'sph, cyl, stock_qty required' }); return
  }
  const product = db.prepare('SELECT * FROM lens_products WHERE id = ?').get(id) as any
  if (!product) { res.status(404).json({ success: false, error: 'Not found' }); return }

  const existing = db.prepare(
    'SELECT * FROM lens_variants WHERE product_id = ? AND sph = ? AND cyl = ?'
  ).get(id, sph, cyl) as any

  const qty = Math.max(0, Math.round(stock_qty))

  let variant: any
  if (existing) {
    const costVal = typeof cost === 'number' ? cost : existing.cost
    db.prepare('UPDATE lens_variants SET stock_qty = ?, cost = ? WHERE id = ?').run(qty, costVal, existing.id)
    variant = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(existing.id)
  } else {
    const costVal = typeof cost === 'number' ? cost : 0
    const sku = autoSKU(product, sph, cyl)
    const result = db.prepare(
      'INSERT INTO lens_variants (product_id, sku, barcode, sph, cyl, axis, add_power, stock_qty, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sku, '', sph, cyl, '', '', qty, costVal, nowTH())
    variant = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(result.lastInsertRowid)
  }
  res.json({ success: true, data: variant })
})

// POST /lens-products/:id/variants
router.post('/:id/variants', (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const { sku, barcode, sph, cyl, axis, add_power, stock_qty, cost } = req.body
  const product = db.prepare('SELECT * FROM lens_products WHERE id = ?').get(id) as any
  if (!product) { res.status(404).json({ success: false, error: 'Not found' }); return }
  const finalSku = sku || autoSKU(product, sph ?? '0.00', cyl ?? '0.00')
  const result = db.prepare(
    'INSERT INTO lens_variants (product_id, sku, barcode, sph, cyl, axis, add_power, stock_qty, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, finalSku, barcode ?? '', sph ?? '', cyl ?? '', axis ?? '', add_power ?? '', stock_qty ?? 0, cost ?? 0, nowTH())
  const row = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ success: true, data: row })
})

// PUT /lens-products/:id/variants/:vid
router.put('/:id/variants/:vid', (req: Request, res: Response) => {
  const vid = parseInt(req.params.vid)
  if (isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const { sku, barcode, sph, cyl, axis, add_power, stock_qty, cost } = req.body
  db.prepare(
    'UPDATE lens_variants SET sku=?, barcode=?, sph=?, cyl=?, axis=?, add_power=?, stock_qty=?, cost=? WHERE id=?'
  ).run(sku ?? '', barcode ?? '', sph ?? '', cyl ?? '', axis ?? '', add_power ?? '', stock_qty ?? 0, cost ?? 0, vid)
  const row = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(vid)
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return }
  res.json({ success: true, data: row })
})

// DELETE /lens-products/:id/variants/:vid
router.delete('/:id/variants/:vid', (req: Request, res: Response) => {
  const vid = parseInt(req.params.vid)
  if (isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  db.prepare('DELETE FROM lens_variants WHERE id = ?').run(vid)
  res.json({ success: true })
})

// PATCH /lens-products/:id/variants/:vid/stock
router.patch('/:id/variants/:vid/stock', (req: Request, res: Response) => {
  const vid = parseInt(req.params.vid)
  if (isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const { delta } = req.body
  if (typeof delta !== 'number') { res.status(400).json({ success: false, error: 'delta must be a number' }); return }
  const variant = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(vid) as any
  if (!variant) { res.status(404).json({ success: false, error: 'Not found' }); return }
  db.prepare('UPDATE lens_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(delta, vid)
  const updated = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(vid)
  res.json({ success: true, data: updated })
})

// POST /lens-products/:id/variants/:vid/stock-in — receive stock, recalculate avg cost
router.post('/:id/variants/:vid/stock-in', (req: Request, res: Response) => {
  const id  = parseInt(req.params.id)
  const vid = parseInt(req.params.vid)
  if (isNaN(id) || isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }

  const { qty, cost, note } = req.body
  if (typeof qty !== 'number' || qty <= 0)   { res.status(400).json({ success: false, error: 'qty must be > 0' }); return }
  if (typeof cost !== 'number' || cost < 0)  { res.status(400).json({ success: false, error: 'cost must be >= 0' }); return }

  const variant = db.prepare('SELECT * FROM lens_variants WHERE id = ? AND product_id = ?').get(vid, id) as any
  if (!variant) { res.status(404).json({ success: false, error: 'Variant not found' }); return }

  const currentStock = variant.stock_qty as number
  const currentCost  = variant.cost as number
  const newStock     = currentStock + qty
  const newAvgCost   = newStock > 0 ? (currentStock * currentCost + qty * cost) / newStock : cost

  const tx = db.transaction(() => {
    db.prepare('UPDATE lens_variants SET stock_qty = ?, cost = ? WHERE id = ?').run(newStock, newAvgCost, vid)
    db.prepare(`
      INSERT INTO lens_variant_movements (variant_id, product_id, type, qty, cost, avg_cost_after, note, created_at)
      VALUES (?, ?, 'stock_in', ?, ?, ?, ?, ?)
    `).run(vid, id, qty, cost, newAvgCost, note ?? '', nowTH())
  })
  tx()

  const updated = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(vid)
  res.json({ success: true, data: updated })
})

// POST /lens-products/:id/variants/:vid/stock-out — remove stock, record movement
router.post('/:id/variants/:vid/stock-out', (req: Request, res: Response) => {
  const id  = parseInt(req.params.id)
  const vid = parseInt(req.params.vid)
  if (isNaN(id) || isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }

  const { qty, note } = req.body
  if (typeof qty !== 'number' || qty <= 0) { res.status(400).json({ success: false, error: 'qty must be > 0' }); return }

  const variant = db.prepare('SELECT * FROM lens_variants WHERE id = ? AND product_id = ?').get(vid, id) as any
  if (!variant) { res.status(404).json({ success: false, error: 'Variant not found' }); return }

  const newStock = Math.max(0, (variant.stock_qty as number) - qty)

  const tx = db.transaction(() => {
    db.prepare('UPDATE lens_variants SET stock_qty = ? WHERE id = ?').run(newStock, vid)
    db.prepare(`
      INSERT INTO lens_variant_movements (variant_id, product_id, type, qty, cost, avg_cost_after, note, created_at)
      VALUES (?, ?, 'stock_out', ?, ?, ?, ?, ?)
    `).run(vid, id, -qty, variant.cost, variant.cost, note ?? '', nowTH())
  })
  tx()

  const updated = db.prepare('SELECT * FROM lens_variants WHERE id = ?').get(vid)
  res.json({ success: true, data: updated })
})

// GET /lens-products/:id/variants/:vid/movements
router.get('/:id/variants/:vid/movements', (req: Request, res: Response) => {
  const vid = parseInt(req.params.vid)
  if (isNaN(vid)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return }
  const movements = db.prepare(
    'SELECT * FROM lens_variant_movements WHERE variant_id = ? ORDER BY created_at DESC'
  ).all(vid)
  res.json({ success: true, data: movements })
})

export default router
