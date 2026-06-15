import { Router, Request, Response } from 'express'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const VALID_ORDER_STATUSES = ['waiting', 'arrived', 'cutting', 'ready', 'completed']

function claimStatusFromOrderStatus(orderStatus: string): string {
  if (orderStatus === 'completed') return 'resolved'
  if (orderStatus === 'waiting') return 'pending'
  return 'in_progress'
}

function orderStatusFromClaimStatus(status: string): string {
  if (status === 'resolved') return 'completed'
  if (status === 'in_progress') return 'cutting'
  return 'waiting'
}

function actorName(req: Request): string {
  const u = req.user
  if (!u) return ''
  return [u.nickname || u.first_name, u.last_name].filter(Boolean).join(' ') || u.user
}

function insertStatusLog(kind: string, id: string, fromStatus: string, toStatus: string, changedBy: string) {
  if (fromStatus === toStatus) return
  db.prepare(`
    INSERT INTO order_status_logs (order_kind, order_id, from_status, to_status, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(kind, id, fromStatus, toStatus, changedBy, nowTH())
}

// GET /claims/outstanding — claims with fee > 0 that are unpaid
router.get('/outstanding', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT cl.*, cu.first_name, cu.last_name, cu.phone_no,
           (SELECT MAX(cp.paid_at) FROM claim_payments cp WHERE cp.claim_id = cl.id) as last_payment_date
    FROM claims cl
    JOIN customers cu ON cu.customer_id = cl.customer_id
    WHERE cl.fee > 0 AND cl.payment_status IN ('pending', 'partial')
    ORDER BY cl.created_at ASC
  `).all()
  res.json({ success: true, data: rows, count: (rows as any[]).length })
})

// GET /claims
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT cl.*,
      cu.first_name, cu.last_name, cu.phone_no,
      p.date as purchase_date, p.total as purchase_total,
      p.lens_data, p.frame_data, p.other_data
    FROM claims cl
    JOIN customers cu ON cu.customer_id = cl.customer_id
    JOIN purchases p ON p.id = cl.purchase_id
    ORDER BY cl.created_at DESC
  `).all()
  res.json({ success: true, data: rows })
})

router.get('/:id/status-logs', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM order_status_logs
    WHERE order_kind = 'claim' AND order_id = ?
    ORDER BY changed_at DESC, id DESC
  `).all(req.params.id)
  res.json({ success: true, data: rows })
})

// POST /claims
router.post('/', (req: Request, res: Response) => {
  const { purchase_id, customer_id, claim_type, description, fee, pickup_date, items } = req.body
  if (!purchase_id || !customer_id) {
    res.status(400).json({ success: false, error: 'purchase_id and customer_id required' }); return
  }

  const purchase = db.prepare(`
    SELECT id, customer_id
    FROM purchases
    WHERE id = ?
  `).get(purchase_id) as { id: string; customer_id: string } | undefined

  if (!purchase) {
    res.status(404).json({ success: false, error: 'ไม่พบรายการขายที่อ้างอิงสำหรับการเคลมนี้' }); return
  }

  if (purchase.customer_id !== customer_id) {
    res.status(400).json({ success: false, error: 'รายการขายนี้ไม่ได้เป็นของลูกค้าที่เลือก' }); return
  }

  const feeNum = fee ?? 0
  const payment_status = feeNum > 0 ? 'pending' : 'paid'
  const id = genId()

  const stockItems: { product_id: number; qty: number; cost: number }[] = Array.isArray(items) ? items : []

  const createTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO claims (id, purchase_id, customer_id, claim_type, description, fee, payment_status, pickup_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, purchase_id, customer_id, claim_type ?? '', description ?? '', feeNum, payment_status, pickup_date ?? '', nowTH(), nowTH())

    for (const item of stockItems) {
      const product = db.prepare('SELECT id, name, barcode, stock_current, avg_cost FROM products WHERE id = ?').get(item.product_id) as any
      if (!product) continue
      const qty = Math.max(1, Math.floor(item.qty) || 1)
      if (product.stock_current < qty) {
        throw new Error(`สินค้า "${product.name}" มีในสต็อก ${product.stock_current} ชิ้น ไม่พอสำหรับ ${qty} ชิ้น`)
      }
      const cost = item.cost ?? product.avg_cost ?? 0
      db.prepare(`
        INSERT INTO claim_items (claim_id, product_id, product_name, barcode, qty, cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, product.id, product.name, product.barcode, qty, cost, nowTH())
      db.prepare('UPDATE products SET stock_current = stock_current - ? WHERE id = ?').run(qty, product.id)
      db.prepare(`INSERT INTO stock_movements (product_id, type, qty, cost, reference, created_at) VALUES (?, 'warranty', ?, ?, ?, ?)`)
        .run(product.id, -qty, cost, id, nowTH())
    }
  })

  try {
    createTx()
  } catch (err: any) {
    if (err?.message?.includes('FOREIGN KEY constraint failed')) {
      res.status(400).json({ success: false, error: 'ข้อมูลอ้างอิงของการเคลมไม่ถูกต้อง กรุณาเลือกรายการขายใหม่อีกครั้ง' }); return
    }
    res.status(400).json({ success: false, error: err.message ?? 'Failed to save claim' }); return
  }

  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(id)
  const claimItems = db.prepare('SELECT * FROM claim_items WHERE claim_id = ?').all(id)
  res.status(201).json({ success: true, data: row, items: claimItems })
})

// PATCH /claims/:id
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM claims WHERE id = ?').get(id) as any
  if (!existing) { res.status(404).json({ success: false, error: 'Not found' }); return }

  const { status, order_status, description, fee, claim_type, pickup_date, payment_status } = req.body
  if (order_status !== undefined && !VALID_ORDER_STATUSES.includes(order_status)) {
    res.status(400).json({ success: false, error: 'Invalid order_status' }); return
  }

  // Auto-clear payment when fee is set to 0; auto-set pending when fee added
  let resolvedPaymentStatus = payment_status ?? null
  const resolvedStatus = order_status ? claimStatusFromOrderStatus(order_status) : status
  const resolvedOrderStatus = order_status ?? (status ? orderStatusFromClaimStatus(status) : null)
  if (fee !== undefined && fee !== null) {
    if (Number(fee) === 0) resolvedPaymentStatus = 'paid'
    else if (existing.payment_status === 'paid' && Number(fee) > 0 && payment_status === undefined) {
      resolvedPaymentStatus = null // keep existing
    }
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE claims SET
        status         = COALESCE(?, status),
        order_status   = COALESCE(?, order_status),
        description    = COALESCE(?, description),
        fee            = COALESCE(?, fee),
        claim_type     = COALESCE(?, claim_type),
        pickup_date    = COALESCE(?, pickup_date),
        payment_status = COALESCE(?, payment_status),
        resolved_at    = CASE WHEN ? = 'resolved' THEN datetime('now','localtime') ELSE resolved_at END,
        updated_at     = datetime('now','localtime')
      WHERE id = ?
    `).run(
      resolvedStatus        ?? null,
      resolvedOrderStatus   ?? null,
      description           ?? null,
      fee                   ?? null,
      claim_type            ?? null,
      pickup_date           ?? null,
      resolvedPaymentStatus ?? null,
      resolvedStatus        ?? null,
      id
    )
    if (resolvedOrderStatus) {
      insertStatusLog('claim', id, existing.order_status ?? orderStatusFromClaimStatus(existing.status), resolvedOrderStatus, actorName(req))
    }
  })
  tx()
  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

// GET /claims/:id/items
router.get('/:id/items', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM claim_items WHERE claim_id = ? ORDER BY id ASC').all(req.params.id)
  res.json({ success: true, data: rows })
})

// DELETE /claims/:id
router.delete('/:id', (req: Request, res: Response) => {
  const claimItems = db.prepare('SELECT * FROM claim_items WHERE claim_id = ?').all(req.params.id) as any[]

  const deleteTx = db.transaction(() => {
    for (const item of claimItems) {
      db.prepare('UPDATE products SET stock_current = stock_current + ? WHERE id = ?').run(item.qty, item.product_id)
      db.prepare(`DELETE FROM stock_movements WHERE reference = ? AND type = 'warranty' AND product_id = ?`).run(req.params.id, item.product_id)
    }
    db.prepare('DELETE FROM claims WHERE id = ?').run(req.params.id)
  })

  deleteTx()
  res.json({ success: true })
})

export default router
