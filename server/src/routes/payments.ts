import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'
import { recordAuditLog } from '../services/auditLog'

const router = Router({ mergeParams: true })
router.use(requireAuth)

function calcStatus(total: number, paid: number): string {
  if (paid <= 0) return 'pending'
  if (paid >= total) return 'paid'
  return 'partial'
}

function actorDisplayName(req: Request): string {
  const user = req.user
  if (!user) return ''
  return [user.nickname || user.first_name, user.last_name].filter(Boolean).join(' ') || user.user
}

function activePurchase(purchaseId: string) {
  return db.prepare(
    "SELECT * FROM purchases WHERE id = ? AND COALESCE(voided_at, '') = ''"
  ).get(purchaseId) as any
}

function recalculatePurchasePayment(purchaseId: string) {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  if (!purchase) return null

  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS paid_amount
    FROM payments
    WHERE purchase_id = ? AND COALESCE(voided_at, '') = ''
  `).get(purchaseId) as any

  const paidAmount = Number(row?.paid_amount ?? 0)
  db.prepare(`
    UPDATE purchases
    SET paid_amount = ?, payment_status = ?
    WHERE id = ?
  `).run(paidAmount, calcStatus(Number(purchase.total ?? 0), paidAmount), purchaseId)

  return db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
}

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
    created_at:       row.created_at,
  }
}

const paymentBodySchema = z.object({
  amount:  z.number({ invalid_type_error: 'กรุณากรอกจำนวน' }).min(1, 'จำนวนต้องมากกว่า 0'),
  method:  z.enum(['cash', 'transfer', 'card', 'qr']),
  note:    z.string().default(''),
  paid_at: z.string().min(1, 'กรุณาเลือกวันที่'),
})

// GET /api/purchases/:purchaseId/payments
router.get('/', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const purchase = activePurchase(purchaseId)
  if (!purchase) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const rows = db.prepare(
    "SELECT * FROM payments WHERE purchase_id = ? AND COALESCE(voided_at, '') = '' ORDER BY paid_at ASC, created_at ASC"
  ).all(purchaseId)

  res.json({ success: true, data: rows })
})

// POST /api/purchases/:purchaseId/payments
router.post('/', (req: Request, res: Response) => {
  const { purchaseId } = req.params
  const purchase = activePurchase(purchaseId)
  if (!purchase) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const parsed = paymentBodySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return }

  const d = parsed.data
  const payId = `pay-${Date.now()}`

  const insertAndUpdate = db.transaction(() => {
    db.prepare(`
      INSERT INTO payments (id, purchase_id, amount, method, note, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payId, purchaseId, d.amount, d.method, d.note, d.paid_at, nowTH())

    const newPaid = (purchase.paid_amount ?? 0) + d.amount
    db.prepare(
      `UPDATE purchases SET paid_amount = ?, payment_status = ? WHERE id = ?`
    ).run(newPaid, calcStatus(purchase.total, newPaid), purchaseId)
  })

  insertAndUpdate()

  const payment  = db.prepare('SELECT * FROM payments WHERE id = ?').get(payId)
  const updated  = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  recordAuditLog(req, 'payment', payId, 'create', null, payment)

  res.status(201).json({ success: true, data: payment, purchase: rowToPurchase(updated) })
})

// DELETE /api/purchases/:purchaseId/payments/:paymentId  → reverse payment
router.delete('/:paymentId', (req: Request, res: Response) => {
  const { purchaseId, paymentId } = req.params
  const purchase = activePurchase(purchaseId)
  if (!purchase) { res.status(404).json({ success: false, error: 'Purchase not found' }); return }

  const payment = db.prepare(
    "SELECT * FROM payments WHERE id = ? AND purchase_id = ? AND COALESCE(voided_at, '') = ''"
  ).get(paymentId, purchaseId) as any
  if (!payment) { res.status(404).json({ success: false, error: 'Payment not found' }); return }

  const deleteAndUpdate = db.transaction(() => {
    db.prepare(`
      UPDATE payments
      SET voided_at = ?, voided_by = ?, void_reason = ?
      WHERE id = ?
    `).run(nowTH(), actorDisplayName(req), 'manual reversal', paymentId)
    recordAuditLog(req, 'payment', paymentId, 'delete', payment, db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId))
    recalculatePurchasePayment(purchaseId)
  })

  deleteAndUpdate()

  const updated = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any
  res.json({ success: true, purchase: rowToPurchase(updated) })
})

export default router
