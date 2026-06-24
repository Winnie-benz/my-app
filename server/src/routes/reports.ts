import { Router, Request, Response } from 'express'
import db from '../db/database'
import { requireAdmin, requireAuth } from '../middleware/requireAuth'

const router = Router()
router.use(requireAuth)

router.get('/summary', (_req: Request, res: Response) => {
  const totalRevenue    = (db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM purchases WHERE COALESCE(voided_at, '') = ''`).get() as any).v
  const totalPaid       = (db.prepare(`SELECT COALESCE(SUM(paid_amount),0) as v FROM purchases WHERE COALESCE(voided_at, '') = ''`).get() as any).v
  const totalOrders     = (db.prepare(`SELECT COUNT(*) as v FROM purchases WHERE COALESCE(voided_at, '') = ''`).get() as any).v
  const completedOrders = (db.prepare(`SELECT COUNT(*) as v FROM purchases WHERE COALESCE(voided_at, '') = '' AND order_status='completed'`).get() as any).v

  res.json({
    success: true,
    data: {
      total_revenue:    totalRevenue,
      total_paid:       totalPaid,
      outstanding:      totalRevenue - totalPaid,
      total_orders:     totalOrders,
      completed_orders: completedOrders,
    },
  })
})

router.get('/sales', (req: Request, res: Response) => {
  const range = (req.query.range as string) || '30d'
  const group = (req.query.group as string) || 'day'

  const dateExpr =
    range === '30d' ? `date('now','-30 days','localtime')` :
    range === '6m'  ? `date('now','-6 months','localtime')` :
                     `date('now','-12 months','localtime')`

  const periodExpr = group === 'day'
    ? `strftime('%Y-%m-%d', date)`
    : `strftime('%Y-%m', date)`

  const rows = db.prepare(`
    SELECT ${periodExpr}              as period,
           COUNT(*)                   as count,
           COALESCE(SUM(total),0)     as revenue,
           COALESCE(SUM(paid_amount),0) as paid
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND date >= ${dateExpr}
    GROUP BY period
    ORDER BY period ASC
  `).all()

  res.json({ success: true, data: rows })
})

router.get('/top-products', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '10') || 10, 50)

  const rows = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.sku, p.sell_price,
           COUNT(sm.id)              as sold_count,
           COALESCE(SUM(-sm.qty), 0) as sold_qty
    FROM products p
    JOIN stock_movements sm ON sm.product_id = p.id AND sm.type = 'sale'
    GROUP BY p.id
    ORDER BY sold_count DESC
    LIMIT ?
  `).all(limit)

  res.json({ success: true, data: rows })
})

router.get('/top-categories', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '5') || 5, 20)

  const frames = db.prepare(`
    SELECT p.id, p.name, p.sku, p.barcode, p.sell_price,
           COUNT(sm.id) as sold_count
    FROM products p
    JOIN stock_movements sm ON sm.product_id = p.id AND sm.type = 'sale'
    WHERE p.category = 'กรอบ'
    GROUP BY p.id
    ORDER BY sold_count DESC
    LIMIT ?
  `).all(limit)

  const lenses = db.prepare(`
    SELECT lp.id as product_id, lp.brand, lp.series, lp.lens_type, lp.lens_index,
           COUNT(*) as sold_count
    FROM (
      SELECT lens_variant_id_r as vid FROM purchases WHERE COALESCE(voided_at, '') = '' AND lens_variant_id_r IS NOT NULL
      UNION ALL
      SELECT lens_variant_id_l as vid FROM purchases WHERE COALESCE(voided_at, '') = '' AND lens_variant_id_l IS NOT NULL
    ) t
    JOIN lens_variants lv ON lv.id = t.vid
    JOIN lens_products lp ON lp.id = lv.product_id
    GROUP BY lp.id
    ORDER BY sold_count DESC
    LIMIT ?
  `).all(limit)

  res.json({ success: true, data: { frames, lenses } })
})

router.get('/profit', requireAdmin, (req: Request, res: Response) => {
  const range = (req.query.range as string) || '12m'
  const dateExpr = range === '6m'
    ? `date('now','-6 months','localtime')`
    : `date('now','-12 months','localtime')`

  const rows = db.prepare(`
    SELECT strftime('%Y-%m', p.date)                                              as month,
           COALESCE(SUM(p.total), 0)                                              as revenue,
           COALESCE(SUM(
             COALESCE(p.cost_lens,0) + COALESCE(p.cost_frame,0) + COALESCE(p.cost_other,0)
           ), 0)                                                                   as cost,
           COALESCE(SUM(
             (SELECT COALESCE(SUM(ci.cost * ci.qty),0)
              FROM claims cl JOIN claim_items ci ON ci.claim_id = cl.id
              WHERE cl.purchase_id = p.id
                AND COALESCE(cl.deleted_at, '') = '')
           ), 0)                                                                   as warranty_cost,
           SUM(CASE WHEN p.cost_lens IS NULL OR p.cost_frame IS NULL OR p.cost_other IS NULL
                    THEN 1 ELSE 0 END)                                             as pending_count
    FROM purchases p
    WHERE COALESCE(p.voided_at, '') = ''
      AND p.date >= ${dateExpr}
    GROUP BY month
    ORDER BY month ASC
  `).all() as any[]

  const data = rows.map(r => ({
    month:         r.month,
    revenue:       r.revenue,
    cost:          r.cost + r.warranty_cost,
    warranty_cost: r.warranty_cost,
    profit:        r.revenue - r.cost - r.warranty_cost,
    pending_count: r.pending_count,
  }))

  res.json({ success: true, data })
})

router.get('/monthly', (req: Request, res: Response) => {
  const now   = new Date()
  const month = (req.query.month as string) ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const summary = db.prepare(`
    SELECT COUNT(*)                        as order_count,
           COALESCE(SUM(total),0)          as revenue,
           COALESCE(AVG(total),0)          as avg_bill,
           COUNT(DISTINCT customer_id)     as customer_count
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND strftime('%Y-%m', date) = ?
  `).get(month) as any

  const newCustomers = (db.prepare(`
    SELECT COUNT(*) as cnt FROM (
      SELECT customer_id, MIN(date) as first_date
      FROM purchases
      WHERE COALESCE(voided_at, '') = ''
      GROUP BY customer_id
    ) WHERE strftime('%Y-%m', first_date) = ?
  `).get(month) as any).cnt

  const gender = db.prepare(`
    SELECT COALESCE(NULLIF(c.gender,''), 'unspecified') as gender, COUNT(*) as cnt
    FROM purchases p
    JOIN customers c ON c.customer_id = p.customer_id
    WHERE COALESCE(p.voided_at, '') = ''
      AND strftime('%Y-%m', p.date) = ?
    GROUP BY gender
  `).all(month)

  const age_groups = db.prepare(`
    WITH aged AS (
      SELECT
        CAST(strftime('%Y','now','localtime') AS INTEGER)
          - CAST(strftime('%Y', c.birthday) AS INTEGER)
          - CASE WHEN strftime('%m-%d','now','localtime') < strftime('%m-%d', c.birthday)
                 THEN 1 ELSE 0 END AS age
      FROM purchases p
      JOIN customers c ON c.customer_id = p.customer_id
      WHERE COALESCE(p.voided_at, '') = ''
        AND strftime('%Y-%m', p.date) = ?
        AND c.birthday != ''
    )
    SELECT
      CASE
        WHEN age < 18 THEN 'under18'
        WHEN age < 31 THEN '18-30'
        WHEN age < 46 THEN '31-45'
        WHEN age < 61 THEN '46-60'
        ELSE 'over60'
      END as age_group,
      COUNT(*) as cnt
    FROM aged GROUP BY age_group
  `).all(month)

  const source_breakdown = db.prepare(`
    SELECT COALESCE(NULLIF(c.source,''), 'other') as source, COUNT(*) as cnt
    FROM customers c
    WHERE c.customer_id IN (
      SELECT customer_id FROM (
        SELECT customer_id, MIN(date) as first_date
        FROM purchases
        WHERE COALESCE(voided_at, '') = ''
        GROUP BY customer_id
      ) WHERE strftime('%Y-%m', first_date) = ?
    )
    GROUP BY source
  `).all(month)

  const lens_type_breakdown = db.prepare(`
    SELECT COALESCE(NULLIF(json_extract(lens_data, '$.lens_type'),''), 'other') as lens_type,
           COUNT(*) as cnt
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND strftime('%Y-%m', date) = ?
      AND json_extract(lens_data, '$.enabled') = 1
      AND COALESCE(json_extract(lens_data, '$.lens_type'), '') != ''
    GROUP BY lens_type
    ORDER BY cnt DESC
  `).all(month)

  res.json({ success: true, data: { month, ...summary, new_customers: newCustomers, gender, age_groups, source_breakdown, lens_type_breakdown } })
})

export default router
