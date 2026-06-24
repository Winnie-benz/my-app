import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

function actorName(req: Request): string {
  const u = req.user
  if (!u) return ''
  return [u.nickname || u.first_name, u.last_name].filter(Boolean).join(' ') || u.user
}

function todayStr(): string {
  return nowTH().slice(0, 10)
}

type Totals = { cash: number; transfer: number; card: number; qr: number; total: number }

function computeTotals(date: string): Totals {
  const rows = db.prepare(`
    SELECT method, COALESCE(SUM(amount), 0) AS total
    FROM (
      SELECT method, amount, paid_at FROM payments WHERE voided_at = ''
      UNION ALL
      SELECT method, amount, paid_at FROM claim_payments
    )
    WHERE substr(paid_at, 1, 10) = ?
    GROUP BY method
  `).all(date) as { method: string; total: number }[]

  const t: Totals = { cash: 0, transfer: 0, card: 0, qr: 0, total: 0 }
  for (const r of rows) {
    if (r.method === 'cash') t.cash = r.total
    else if (r.method === 'transfer') t.transfer = r.total
    else if (r.method === 'card') t.card = r.total
    else if (r.method === 'qr') t.qr = r.total
    t.total += r.total
  }
  return t
}

function lastFloat(): number {
  const row = db.prepare(`
    SELECT opening_float FROM daily_closes
    ORDER BY close_date DESC LIMIT 1
  `).get() as { opening_float: number } | undefined
  return row?.opening_float ?? 0
}

router.get('/today', (_req: Request, res: Response) => {
  const date = todayStr()
  const totals = computeTotals(date)
  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date) as any
  const suggested_float = lastFloat()
  const opening_float: number | null = row ? row.opening_float : null
  const expected_cash = (opening_float ?? suggested_float) + totals.cash

  const unclosed = db.prepare(`
    SELECT close_date FROM daily_closes
    WHERE status = 'open' AND close_date < ?
    ORDER BY close_date DESC LIMIT 1
  `).get(date) as { close_date: string } | undefined

  res.json({ success: true, data: {
    date,
    status: row ? row.status : 'none',
    totals,
    opening_float,
    suggested_float,
    expected_cash,
    close: row || null,
    unclosed_previous: unclosed?.close_date ?? null,
  }})
})

const openSchema = z.object({
  opening_float: z.number().min(0),
  date: z.string().optional(),
})

router.post('/open', (req: Request, res: Response) => {
  const parsed = openSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: 'opening_float ไม่ถูกต้อง' }); return }
  const date = parsed.data.date || todayStr()

  const existing = db.prepare('SELECT status FROM daily_closes WHERE close_date = ?').get(date) as any
  if (existing && existing.status === 'closed') {
    res.status(400).json({ success: false, error: 'วันนี้ปิดยอดไปแล้ว' }); return
  }

  db.prepare(`
    INSERT INTO daily_closes (close_date, status, opening_float, opened_by, opened_at)
    VALUES (?, 'open', ?, ?, ?)
    ON CONFLICT(close_date) DO UPDATE SET
      status = 'open', opening_float = excluded.opening_float,
      opened_by = excluded.opened_by, opened_at = excluded.opened_at
  `).run(date, parsed.data.opening_float, actorName(req), nowTH())

  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date)
  res.json({ success: true, data: row })
})

const closeSchema = z.object({
  counted_cash: z.number().min(0),
  opening_float: z.number().min(0).optional(),
  note: z.string().optional(),
  date: z.string().optional(),
})

router.post('/close', (req: Request, res: Response) => {
  const parsed = closeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: 'ข้อมูลปิดยอดไม่ถูกต้อง' }); return }
  const date = parsed.data.date || todayStr()
  const existing = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date) as any

  const totals = computeTotals(date)
  const opening_float = parsed.data.opening_float ?? (existing ? existing.opening_float : lastFloat())
  const expected_cash = opening_float + totals.cash
  const difference = parsed.data.counted_cash - expected_cash
  const note = parsed.data.note ?? ''

  db.prepare(`
    INSERT INTO daily_closes (
      close_date, status, opening_float, opened_by, opened_at,
      total_cash, total_transfer, total_card, total_qr, total_sales,
      expected_cash, counted_cash, difference, note, closed_by, closed_at
    ) VALUES (?, 'closed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(close_date) DO UPDATE SET
      status = 'closed', opening_float = excluded.opening_float,
      total_cash = excluded.total_cash, total_transfer = excluded.total_transfer,
      total_card = excluded.total_card, total_qr = excluded.total_qr,
      total_sales = excluded.total_sales, expected_cash = excluded.expected_cash,
      counted_cash = excluded.counted_cash, difference = excluded.difference,
      note = excluded.note, closed_by = excluded.closed_by, closed_at = excluded.closed_at
  `).run(
    date, opening_float,
    existing ? existing.opened_by : '', existing ? existing.opened_at : '',
    totals.cash, totals.transfer, totals.card, totals.qr, totals.total,
    expected_cash, parsed.data.counted_cash, difference, note,
    actorName(req), nowTH(),
  )

  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date)
  res.json({ success: true, data: row })
})

router.get('/history', (req: Request, res: Response) => {
  const raw = Number(req.query.limit ?? 30)
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(100, Math.floor(raw))) : 30
  const rows = db.prepare(`
    SELECT * FROM daily_closes WHERE status = 'closed'
    ORDER BY close_date DESC LIMIT ?
  `).all(limit)
  res.json({ success: true, data: rows })
})

export default router
