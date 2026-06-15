import { Router, Request, Response } from 'express'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

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
    stock_override:     row.stock_override_data ? {
      by:       row.stock_override_by,
      at:       row.stock_override_at,
      warnings: JSON.parse(row.stock_override_data),
    } : null,
    created_at:        row.created_at,
  }
}

const VALID_ORDER_STATUSES = ['waiting', 'arrived', 'cutting', 'ready', 'completed']

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

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT * FROM purchases ORDER BY date DESC, created_at DESC'
  ).all() as any[]
  res.json({ success: true, data: rows.map(rowToPurchase) })
})

router.get('/outstanding', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT p.*, c.first_name, c.last_name, c.phone_no,
           (SELECT MAX(pay.paid_at) FROM payments pay WHERE pay.purchase_id = p.id) as last_payment_date
    FROM purchases p
    LEFT JOIN customers c ON c.customer_id = p.customer_id
    WHERE p.payment_status IN ('pending', 'partial')
    ORDER BY p.date ASC
  `).all() as any[]
  const data = rows.map(row => ({
    purchase:          rowToPurchase(row),
    customer:          { customer_id: row.customer_id, first_name: row.first_name, last_name: row.last_name, phone_no: row.phone_no },
    last_payment_date: row.last_payment_date ?? null,
  }))
  res.json({ success: true, data, count: data.length })
})

router.get('/pending-costs', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT p.*, c.first_name, c.last_name
    FROM purchases p
    LEFT JOIN customers c ON c.customer_id = p.customer_id
    WHERE p.cost_lens IS NULL OR p.cost_frame IS NULL OR p.cost_other IS NULL
    ORDER BY p.date DESC, p.created_at DESC
  `).all() as any[]
  const data = rows.map(row => ({
    purchase: rowToPurchase(row),
    customer: { customer_id: row.customer_id, first_name: row.first_name, last_name: row.last_name },
  }))
  res.json({ success: true, data, count: data.length })
})

router.get('/:purchaseId/status-logs', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM order_status_logs
    WHERE order_kind = 'purchase' AND order_id = ?
    ORDER BY changed_at DESC, id DESC
  `).all(req.params.purchaseId)
  res.json({ success: true, data: rows })
})

router.patch('/:purchaseId/costs', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const { cost_lens, cost_frame, cost_other } = req.body

  const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  if (!existing) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const updates: Record<string, number | null> = {}
  if (cost_lens  !== undefined) updates.cost_lens  = cost_lens  === null ? null : Number(cost_lens)
  if (cost_frame !== undefined) updates.cost_frame = cost_frame === null ? null : Number(cost_frame)
  if (cost_other !== undefined) updates.cost_other = cost_other === null ? null : Number(cost_other)

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No cost fields provided' }); return
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE purchases SET ${setClauses} WHERE id = @id`).run({ ...updates, id: purchaseId })

  const updated = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  res.json({ success: true, data: rowToPurchase(updated) })
})

// PATCH /api/purchases/:purchaseId/status
router.patch('/:purchaseId/status', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const { order_status } = req.body

  if (!VALID_ORDER_STATUSES.includes(order_status)) {
    res.status(400).json({ success: false, error: 'Invalid order_status' }); return
  }

  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  if (!row) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const updateTx = db.transaction(() => {
    db.prepare('UPDATE purchases SET order_status = ? WHERE id = ?').run(order_status, purchaseId)
    insertStatusLog('purchase', purchaseId, row.order_status ?? 'waiting', order_status, actorName(req))
  })
  updateTx()

  const updated = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  res.json({ success: true, data: rowToPurchase(updated) })
})

export default router
