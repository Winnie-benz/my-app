import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router({ mergeParams: true })
router.use(requireAuth)

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToPurchase(row: any) {
  return {
    id:               row.id,
    customer_id:      row.customer_id,
    date:             row.date,
    lens:             JSON.parse(row.lens_data),
    frame:            JSON.parse(row.frame_data),
    other:            JSON.parse(row.other_data),
    price_lens:       JSON.parse(row.price_lens),
    price_frame:      JSON.parse(row.price_frame),
    price_other:      JSON.parse(row.price_other),
    special_discount: row.special_discount,
    total:            row.total,
    pickup_date:      row.pickup_date,
    pickup_time:      row.pickup_time,
    payment_status:   row.payment_status ?? 'pending',
    paid_amount:      row.paid_amount ?? 0,
    order_status:     row.order_status  ?? 'waiting',
    cost_lens:        row.cost_lens  !== undefined ? row.cost_lens  : null,
    cost_frame:       row.cost_frame !== undefined ? row.cost_frame : null,
    cost_other:       row.cost_other !== undefined ? row.cost_other : null,
    prev_rx:          row.prev_rx_data  ? JSON.parse(row.prev_rx_data)  : null,
    order_rx:         row.order_rx_data ? JSON.parse(row.order_rx_data) : null,
    lens_variant_id_r: row.lens_variant_id_r ?? null,
    lens_variant_id_l: row.lens_variant_id_l ?? null,
    sold_by_staff_id:  row.sold_by_staff_id ?? '',
    sold_by_name:      row.sold_by_name ?? '',
    stock_override:     row.stock_override_data ? {
      by:       row.stock_override_by,
      at:       row.stock_override_at,
      warnings: JSON.parse(row.stock_override_data),
    } : null,
    created_at:        row.created_at,
  }
}

type StockWarning = {
  kind: 'product' | 'lens_variant'
  label: string
  name: string
  identifier: string
  current_stock: number
  requested_qty: number
  after_stock: number
}

function findProductForSale(item: any) {
  if (!item) return null
  if (item.product_id) {
    const byId = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.product_id)) as any
    if (byId) return byId
  }
  const identifier = item.barcode || item.sku
  if (!identifier) return null
  return db.prepare('SELECT * FROM products WHERE barcode = ? OR sku = ?').get(identifier, identifier) as any
}

function calcItemCost(item: any, field: 'lens' | 'frame' | 'other'): number | null {
  if (!item?.enabled) return 0
  if (field === 'lens') {
    if (item.lens_kind === 'rx' || item.lens_kind === 'stock_order') return null
    if (item.barcode || item.sku || item.product_id) {
      const p = findProductForSale(item)
      if (p) return p.avg_cost ?? 0
    }
    return 0
  }
  if (field === 'frame') {
    if (item.source === 'pre_order') return null
    if (item.source === 'customer') return 0
    if (item.barcode || item.sku || item.product_id) {
      const p = findProductForSale(item)
      if (p) return p.avg_cost ?? 0
    }
    return 0
  }
  // other
  if (item.source === 'pre_order') return null
  if (item.barcode || item.sku || item.product_id) {
    const p = findProductForSale(item)
    if (p) return p.avg_cost ?? 0
  }
  return 0
}

function calcStatus(total: number, paid: number): string {
  if (paid <= 0) return 'pending'
  if (paid >= total) return 'paid'
  return 'partial'
}

const priceBlockSchema = z.object({
  full:       z.number().min(0),
  percent:    z.number().default(0),
  discounted: z.number().min(0),
})

const eyeRxSchema = z.object({
  sph: z.string(), cyl: z.string(), axs: z.string(), prism: z.string(),
  add: z.string(), va: z.string(), pd: z.string(), fh: z.string(),
})

const purchaseBodySchema = z.object({
  date:             z.string().min(1),
  lens:             z.record(z.unknown()),
  frame:            z.record(z.unknown()),
  other:            z.record(z.unknown()),
  price_lens:       priceBlockSchema,
  price_frame:      priceBlockSchema,
  price_other:      priceBlockSchema,
  special_discount: z.number().min(0).default(0),
  total:            z.number().min(0),
  pickup_date:      z.string().default(''),
  pickup_time:      z.string().default(''),
  prev_rx:          z.object({ right: eyeRxSchema, left: eyeRxSchema }).nullable().optional(),
  order_rx:         z.object({ right: eyeRxSchema, left: eyeRxSchema }).nullable().optional(),
  lens_variant_id_r: z.number().int().nullable().optional(),
  lens_variant_id_l: z.number().int().nullable().optional(),
})

const createPurchaseSchema = purchaseBodySchema.extend({
  initial_payment: z.object({
    amount:  z.number().min(0),
    method:  z.enum(['cash', 'transfer', 'card', 'qr']),
    note:    z.string().default(''),
    paid_at: z.string().default(''),
  }).optional(),
  stock_override_confirmed: z.boolean().optional(),
})

function addProductDeduction(
  map: Map<number, { product: any; requested_qty: number; labels: string[] }>,
  saleItem: any,
  label: string,
) {
  const p = findProductForSale(saleItem)
  if (!p) return
  const existing = map.get(p.id)
  if (existing) {
    existing.requested_qty += 1
    existing.labels.push(label)
  } else {
    map.set(p.id, { product: p, requested_qty: 1, labels: [label] })
  }
}

function addLensVariantDeduction(
  map: Map<number, { variant: any; product: any; requested_qty: number; labels: string[] }>,
  variantId: number | null | undefined,
  label: string,
) {
  if (!variantId) return
  const row = db.prepare(`
    SELECT lv.*, lp.brand, lp.series, lp.lens_type, lp.lens_index, lp.coating
    FROM lens_variants lv
    JOIN lens_products lp ON lp.id = lv.product_id
    WHERE lv.id = ?
  `).get(variantId) as any
  if (!row) return
  const item = map.get(row.id)
  if (item) {
    item.requested_qty += 1
    item.labels.push(label)
  } else {
    map.set(row.id, { variant: row, product: row, requested_qty: 1, labels: [label] })
  }
}

function restoredProductQtyForPurchase(purchaseId: string | undefined, productId: number): number {
  if (!purchaseId) return 0
  const row = db.prepare(`
    SELECT COALESCE(SUM(ABS(qty)),0) as qty
    FROM stock_movements
    WHERE reference = ? AND type = 'sale' AND product_id = ?
  `).get(purchaseId, productId) as any
  return Number(row?.qty ?? 0)
}

function restoredLensVariantQtyForPurchase(purchaseId: string | undefined, variantId: number): number {
  if (!purchaseId) return 0
  const row = db.prepare(`
    SELECT lens_variant_id_r, lens_variant_id_l
    FROM purchases
    WHERE id = ?
  `).get(purchaseId) as any
  if (!row) return 0
  return [row.lens_variant_id_r, row.lens_variant_id_l].filter(id => id === variantId).length
}

function stockWarningsForPurchase(d: z.infer<typeof purchaseBodySchema>, existingPurchaseId?: string): StockWarning[] {
  const lens  = d.lens  as any
  const frame = d.frame as any
  const other = d.other as any
  const productDeductions = new Map<number, { product: any; requested_qty: number; labels: string[] }>()
  const lensDeductions = new Map<number, { variant: any; product: any; requested_qty: number; labels: string[] }>()

  if (lens.enabled && lens.lens_kind === 'stock_store') addProductDeduction(productDeductions, lens, 'เลนส์')
  if (frame.enabled && frame.source === 'store') addProductDeduction(productDeductions, frame, 'กรอบ')
  if (other.enabled && other.source === 'store') addProductDeduction(productDeductions, other, 'สินค้าอื่นๆ')
  addLensVariantDeduction(lensDeductions, d.lens_variant_id_r, 'เลนส์ขวา')
  addLensVariantDeduction(lensDeductions, d.lens_variant_id_l, 'เลนส์ซ้าย')

  const warnings: StockWarning[] = []
  for (const { product, requested_qty, labels } of productDeductions.values()) {
    const current_stock = product.stock_current + restoredProductQtyForPurchase(existingPurchaseId, product.id)
    const after_stock = current_stock - requested_qty
    if (after_stock < 0) {
      warnings.push({
        kind: 'product',
        label: labels.join(' + '),
        name: product.name,
        identifier: product.sku || product.barcode,
        current_stock,
        requested_qty,
        after_stock,
      })
    }
  }
  for (const { variant, requested_qty, labels } of lensDeductions.values()) {
    const current_stock = variant.stock_qty + restoredLensVariantQtyForPurchase(existingPurchaseId, variant.id)
    const after_stock = current_stock - requested_qty
    if (after_stock < 0) {
      const name = [variant.brand, variant.series, variant.lens_index ? `index ${variant.lens_index}` : '']
        .filter(Boolean).join(' ')
      warnings.push({
        kind: 'lens_variant',
        label: labels.join(' + '),
        name: `${name || 'เลนส์'} SPH ${variant.sph} CYL ${variant.cyl}`,
        identifier: variant.sku || variant.barcode || String(variant.id),
        current_stock,
        requested_qty,
        after_stock,
      })
    }
  }
  return warnings
}

function actorDisplayName(req: Request): string {
  const user = req.user
  if (!user) return ''
  return [user.nickname || user.first_name, user.last_name].filter(Boolean).join(' ') || user.user
}

function overrideAudit(req: Request, warnings: StockWarning[]) {
  return {
    data: JSON.stringify(warnings),
    by: actorDisplayName(req),
    at: new Date().toISOString(),
  }
}

// ── List by customer ──────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { customerId } = req.params as { customerId: string }
  const customer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ?').get(customerId)
  if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return }

  const rows = db.prepare(
    'SELECT * FROM purchases WHERE customer_id = ? ORDER BY date DESC, created_at DESC'
  ).all(customerId) as any[]

  res.json({ success: true, data: rows.map(rowToPurchase) })
})

// ── Create ───────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const { customerId } = req.params as { customerId: string }
  const customer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ?').get(customerId)
  if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return }

  const parsed = createPurchaseSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const stockWarnings = stockWarningsForPurchase(d)
  if (stockWarnings.length > 0 && !d.stock_override_confirmed) {
    res.status(409).json({
      success: false,
      error: 'INSUFFICIENT_STOCK',
      message: 'Stock is not enough for this sale.',
      warnings: stockWarnings,
    })
    return
  }
  const override = stockWarnings.length > 0 ? overrideAudit(req, stockWarnings) : null
  const id = `p-${Date.now()}`
  const ip = d.initial_payment
  const paid_amount    = ip && ip.amount > 0 ? ip.amount : 0
  const payment_status = calcStatus(d.total, paid_amount)

  const createTx = db.transaction(() => {
    let cost_lens    = calcItemCost(d.lens  as any, 'lens')
    const cost_frame = calcItemCost(d.frame as any, 'frame')
    const cost_other = calcItemCost(d.other as any, 'other')
    if (d.lens_variant_id_r || d.lens_variant_id_l) {
      let variantCost = 0
      if (d.lens_variant_id_r) {
        const lv = db.prepare('SELECT cost FROM lens_variants WHERE id = ?').get(d.lens_variant_id_r) as any
        if (lv) variantCost += lv.cost ?? 0
      }
      if (d.lens_variant_id_l) {
        const lv = db.prepare('SELECT cost FROM lens_variants WHERE id = ?').get(d.lens_variant_id_l) as any
        if (lv) variantCost += lv.cost ?? 0
      }
      cost_lens = variantCost
    }

    db.prepare(`
      INSERT INTO purchases
        (id, customer_id, date, lens_data, frame_data, other_data,
         price_lens, price_frame, price_other, special_discount, total, pickup_date, pickup_time,
         payment_status, paid_amount, order_status, cost_lens, cost_frame, cost_other,
         prev_rx_data, order_rx_data, lens_variant_id_r, lens_variant_id_l,
         sold_by_staff_id, sold_by_name,
         stock_override_data, stock_override_by, stock_override_at, created_at)
      VALUES
        (@id, @customer_id, @date, @lens_data, @frame_data, @other_data,
         @price_lens, @price_frame, @price_other, @special_discount, @total, @pickup_date, @pickup_time,
         @payment_status, @paid_amount, 'waiting', @cost_lens, @cost_frame, @cost_other,
         @prev_rx_data, @order_rx_data, @lens_variant_id_r, @lens_variant_id_l,
         @sold_by_staff_id, @sold_by_name,
         @stock_override_data, @stock_override_by, @stock_override_at, @created_at)
    `).run({
      id,
      customer_id:       customerId,
      date:              d.date,
      lens_data:         JSON.stringify(d.lens),
      frame_data:        JSON.stringify(d.frame),
      other_data:        JSON.stringify(d.other),
      price_lens:        JSON.stringify(d.price_lens),
      price_frame:       JSON.stringify(d.price_frame),
      price_other:       JSON.stringify(d.price_other),
      special_discount:  d.special_discount,
      total:             d.total,
      pickup_date:       d.pickup_date,
      pickup_time:       d.pickup_time,
      payment_status,
      paid_amount,
      cost_lens,
      cost_frame,
      cost_other,
      prev_rx_data:      d.prev_rx  ? JSON.stringify(d.prev_rx)  : null,
      order_rx_data:     d.order_rx ? JSON.stringify(d.order_rx) : null,
      lens_variant_id_r: d.lens_variant_id_r ?? null,
      lens_variant_id_l: d.lens_variant_id_l ?? null,
      sold_by_staff_id:  req.user?.staff_id ?? '',
      sold_by_name:      actorDisplayName(req),
      stock_override_data: override?.data ?? null,
      stock_override_by:   override?.by ?? '',
      stock_override_at:   override?.at ?? '',
      created_at:          nowTH(),
    })

    if (ip && ip.amount > 0) {
      db.prepare(`
        INSERT INTO payments (id, purchase_id, amount, method, note, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`pay-${Date.now()}`, id, ip.amount, ip.method, ip.note ?? '', ip.paid_at || d.date, nowTH())
    }

    // Server-side stock deduction (atomic with purchase creation)
    const lens  = d.lens  as any
    const frame = d.frame as any
    const other = d.other as any

    const toDeduct = [
      { item: lens,  ok: lens.enabled  && lens.lens_kind === 'stock_store' },
      { item: frame, ok: frame.enabled && frame.source   === 'store' },
      { item: other, ok: other.enabled && other.source   === 'store' },
    ]

    for (const { item, ok } of toDeduct) {
      if (!ok) continue
      const p = findProductForSale(item)
      if (!p) continue
      const newStock = p.stock_current - 1
      db.prepare('UPDATE products SET stock_current = ? WHERE id = ?').run(newStock, p.id)
      db.prepare(`INSERT INTO stock_movements (product_id, type, qty, cost, reference, created_at) VALUES (?, 'sale', -1, ?, ?, ?)`).run(p.id, p.avg_cost ?? 0, id, nowTH())
    }

    if (d.lens_variant_id_r) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty - 1 WHERE id = ?').run(d.lens_variant_id_r)
    if (d.lens_variant_id_l) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty - 1 WHERE id = ?').run(d.lens_variant_id_l)
  })

  try {
    createTx()
  } catch (error) {
    console.error('[POST /api/customers/:customerId/purchases]', error)
    res.status(500).json({
      success: false,
      error: 'PURCHASE_SAVE_FAILED',
      message: error instanceof Error ? error.message : 'Purchase save failed',
    })
    return
  }

  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any
  res.status(201).json({ success: true, data: rowToPurchase(row) })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function restoreLensVariantStock(purchaseId: string) {
  const p = db.prepare('SELECT lens_variant_id_r, lens_variant_id_l FROM purchases WHERE id = ?').get(purchaseId) as any
  if (p?.lens_variant_id_r) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty + 1 WHERE id = ?').run(p.lens_variant_id_r)
  if (p?.lens_variant_id_l) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty + 1 WHERE id = ?').run(p.lens_variant_id_l)
}

function restoreStockForPurchase(purchaseId: string) {
  const movements = db.prepare(
    `SELECT product_id, qty FROM stock_movements WHERE reference = ? AND type = 'sale'`
  ).all(purchaseId) as { product_id: number; qty: number }[]

  for (const m of movements) {
    const p = db.prepare('SELECT stock_current FROM products WHERE id = ?').get(m.product_id) as any
    if (!p) continue
    db.prepare('UPDATE products SET stock_current = ? WHERE id = ?')
      .run(p.stock_current + Math.abs(m.qty), m.product_id)
  }
  db.prepare(`DELETE FROM stock_movements WHERE reference = ? AND type = 'sale'`).run(purchaseId)
}

function applyStockDeductions(lens: any, frame: any, other: any, purchaseId: string) {
  const toDeduct = [
    { item: lens,  ok: lens.enabled  && lens.lens_kind === 'stock_store' },
    { item: frame, ok: frame.enabled && frame.source   === 'store'       },
    { item: other, ok: other.enabled && other.source   === 'store'       },
  ]
  for (const { item, ok } of toDeduct) {
    if (!ok) continue
    const p = findProductForSale(item)
    if (!p) continue
    const newStock = p.stock_current - 1
    db.prepare('UPDATE products SET stock_current = ? WHERE id = ?').run(newStock, p.id)
    db.prepare(`INSERT INTO stock_movements (product_id, type, qty, cost, reference, created_at) VALUES (?, 'sale', -1, ?, ?, ?)`)
      .run(p.id, p.avg_cost ?? 0, purchaseId, nowTH())
  }
}

// ── Update ───────────────────────────────────────────────────────────────────
router.put('/:purchaseId', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId)
  if (!existing) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const parsed = purchaseBodySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const stockWarnings = stockWarningsForPurchase(d, purchaseId)
  if (stockWarnings.length > 0 && !req.body.stock_override_confirmed) {
    res.status(409).json({
      success: false,
      error: 'INSUFFICIENT_STOCK',
      message: 'Stock is not enough for this sale.',
      warnings: stockWarnings,
    })
    return
  }
  const override = stockWarnings.length > 0 ? overrideAudit(req, stockWarnings) : null

  const updateTx = db.transaction(() => {
    restoreStockForPurchase(purchaseId)
    restoreLensVariantStock(purchaseId)

    let cost_lens    = calcItemCost(d.lens  as any, 'lens')
    const cost_frame = calcItemCost(d.frame as any, 'frame')
    const cost_other = calcItemCost(d.other as any, 'other')
    if (d.lens_variant_id_r || d.lens_variant_id_l) {
      let variantCost = 0
      if (d.lens_variant_id_r) {
        const lv = db.prepare('SELECT cost FROM lens_variants WHERE id = ?').get(d.lens_variant_id_r) as any
        if (lv) variantCost += lv.cost ?? 0
      }
      if (d.lens_variant_id_l) {
        const lv = db.prepare('SELECT cost FROM lens_variants WHERE id = ?').get(d.lens_variant_id_l) as any
        if (lv) variantCost += lv.cost ?? 0
      }
      cost_lens = variantCost
    }

    db.prepare(`
      UPDATE purchases SET
        date = @date, lens_data = @lens_data, frame_data = @frame_data, other_data = @other_data,
        price_lens = @price_lens, price_frame = @price_frame, price_other = @price_other,
        special_discount = @special_discount, total = @total,
        pickup_date = @pickup_date, pickup_time = @pickup_time,
        cost_lens = @cost_lens, cost_frame = @cost_frame, cost_other = @cost_other,
        prev_rx_data = @prev_rx_data, order_rx_data = @order_rx_data,
        lens_variant_id_r = @lens_variant_id_r, lens_variant_id_l = @lens_variant_id_l,
        stock_override_data = @stock_override_data,
        stock_override_by = @stock_override_by,
        stock_override_at = @stock_override_at
      WHERE id = @id
    `).run({
      id:                purchaseId,
      date:              d.date,
      lens_data:         JSON.stringify(d.lens),
      frame_data:        JSON.stringify(d.frame),
      other_data:        JSON.stringify(d.other),
      price_lens:        JSON.stringify(d.price_lens),
      price_frame:       JSON.stringify(d.price_frame),
      price_other:       JSON.stringify(d.price_other),
      special_discount:  d.special_discount,
      total:             d.total,
      pickup_date:       d.pickup_date,
      pickup_time:       d.pickup_time,
      cost_lens,
      cost_frame,
      cost_other,
      prev_rx_data:      d.prev_rx  ? JSON.stringify(d.prev_rx)  : null,
      order_rx_data:     d.order_rx ? JSON.stringify(d.order_rx) : null,
      lens_variant_id_r: d.lens_variant_id_r ?? null,
      lens_variant_id_l: d.lens_variant_id_l ?? null,
      stock_override_data: override?.data ?? null,
      stock_override_by:   override?.by ?? '',
      stock_override_at:   override?.at ?? '',
      created_at:          nowTH(),
    })

    applyStockDeductions(d.lens as any, d.frame as any, d.other as any, purchaseId)

    if (d.lens_variant_id_r) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty - 1 WHERE id = ?').run(d.lens_variant_id_r)
    if (d.lens_variant_id_l) db.prepare('UPDATE lens_variants SET stock_qty = stock_qty - 1 WHERE id = ?').run(d.lens_variant_id_l)
  })

  try {
    updateTx()
  } catch (error) {
    console.error('[PUT /api/customers/:customerId/purchases/:purchaseId]', error)
    res.status(500).json({
      success: false,
      error: 'PURCHASE_SAVE_FAILED',
      message: error instanceof Error ? error.message : 'Purchase save failed',
    })
    return
  }

  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  res.json({ success: true, data: rowToPurchase(row) })
})

// ── Delete ───────────────────────────────────────────────────────────────────
router.delete('/:purchaseId', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId)
  if (!existing) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const deleteTx = db.transaction(() => {
    restoreStockForPurchase(purchaseId)
    restoreLensVariantStock(purchaseId)
    db.prepare('DELETE FROM purchases WHERE id = ?').run(purchaseId)
  })

  deleteTx()
  res.json({ success: true })
})

export default router
