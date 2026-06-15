import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'

const router = Router({ mergeParams: true })
router.use(requireAuth)

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const paymentBodySchema = z.object({
  amount:  z.number({ invalid_type_error: 'กรุณากรอกจำนวน' }).min(1, 'จำนวนต้องมากกว่า 0'),
  method:  z.enum(['cash', 'transfer', 'card', 'qr']),
  note:    z.string().default(''),
  paid_at: z.string().min(1, 'กรุณาเลือกวันที่'),
})

function syncStatus(claimId: string) {
  const claim = db.prepare('SELECT fee FROM claims WHERE id = ?').get(claimId) as any
  if (!claim) return
  const { total } = db.prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM claim_payments WHERE claim_id = ?'
  ).get(claimId) as any
  const status = total >= claim.fee ? 'paid' : total > 0 ? 'partial' : 'pending'
  db.prepare(`
    UPDATE claims SET paid_amount = ?, payment_status = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(total, status, claimId)
}

// GET /claims/:claimId/payments
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT * FROM claim_payments WHERE claim_id = ? ORDER BY paid_at ASC, created_at ASC'
  ).all(req.params.claimId)
  res.json({ success: true, data: rows })
})

// POST /claims/:claimId/payments
router.post('/', (req: Request, res: Response) => {
  const { claimId } = req.params
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId) as any
  if (!claim) { res.status(404).json({ success: false, error: 'Claim not found' }); return }

  const parsed = paymentBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() }); return
  }

  const { amount, method, note, paid_at } = parsed.data

  const id = genId()
  try {
    db.prepare(`
      INSERT INTO claim_payments (id, claim_id, amount, method, note, paid_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, claimId, Number(amount), method ?? 'cash', note ?? '',
      paid_at ?? new Date().toISOString().slice(0, 10))
    syncStatus(claimId)
    const payment      = db.prepare('SELECT * FROM claim_payments WHERE id = ?').get(id)
    const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId)
    res.status(201).json({ success: true, data: payment, claim: updatedClaim })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Database error' })
  }
})

// DELETE /claims/:claimId/payments/:paymentId
router.delete('/:paymentId', (req: Request, res: Response) => {
  const { claimId, paymentId } = req.params
  const existing = db.prepare('SELECT id FROM claim_payments WHERE id = ? AND claim_id = ?').get(paymentId, claimId)
  if (!existing) { res.status(404).json({ success: false, error: 'Payment not found' }); return }
  try {
    db.prepare('DELETE FROM claim_payments WHERE id = ? AND claim_id = ?').run(paymentId, claimId)
    syncStatus(claimId)
    const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId)
    res.json({ success: true, claim: updatedClaim })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Database error' })
  }
})

export default router
