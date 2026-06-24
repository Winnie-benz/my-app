import db from '../db/database'

export interface BusinessSnapshot {
  generatedAt: string
  dataWarnings: string[]
  overview: {
    totalCustomers: number
    totalOrders: number
    totalRevenue: number
    avgTicketSize: number
    firstOrderDate: string | null
    lastOrderDate: string | null
    dataPeriodDays: number
  }
  customerDemographics: {
    byGender: { gender: string; count: number }[]
    bySource: { source: string; count: number }[]
    byAgeGroup: { age_group: string; count: number }[]
    byOccupation: { occupation: string; count: number }[]
    missingBirthday: number
  }
  salesByStaff: { staff: string; orderCount: number; revenue: number }[]
  revenueByMonth: {
    month: string
    orderCount: number
    revenue: number
    avgTicket: number
  }[]
  orderStatus: { status: string; count: number }[]
  paymentStatus: {
    status: string
    count: number
    totalAmount: number
  }[]
  paymentMethods: { method: string; count: number; totalAmount: number }[]
  lensTypeDistribution: { lensType: string; count: number }[]
  inventoryAlerts: {
    name: string
    sku: string
    stock: number
    reorderPoint: number
  }[]
  topProducts: { name: string; sku: string; unitsSold: number }[]
  marginSummary: {
    totalRevenue: number
    totalCost: number
    grossProfit: number
    grossMarginPct: number
    ordersWithFullCost: number
    totalOrders: number
  }
  outstandingPayments: {
    count: number
    totalOutstanding: number
  }
}

export function getBusinessSnapshot(): BusinessSnapshot {
  const warnings: string[] = []

  // ── Overview ─────────────────────────────────────────────────────────────
  const overview = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM customers WHERE COALESCE(deleted_at, '') = '') AS totalCustomers,
      (SELECT COUNT(*) FROM purchases WHERE COALESCE(voided_at, '') = '') AS totalOrders,
      (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE COALESCE(voided_at, '') = '') AS totalRevenue,
      (SELECT COALESCE(AVG(total), 0) FROM purchases WHERE COALESCE(voided_at, '') = '') AS avgTicketSize,
      (SELECT MIN(date) FROM purchases WHERE COALESCE(voided_at, '') = '') AS firstOrderDate,
      (SELECT MAX(date) FROM purchases WHERE COALESCE(voided_at, '') = '') AS lastOrderDate
  `).get() as any

  const dataPeriodDays = overview.firstOrderDate
    ? Math.round((new Date().getTime() - new Date(overview.firstOrderDate).getTime()) / 86400000)
    : 0

  if (overview.totalOrders === 0) warnings.push('ยังไม่มีข้อมูล orders — กำลังใช้ข้อมูลโครงสร้างเปล่า')
  if (overview.totalCustomers === 0) warnings.push('ยังไม่มีข้อมูลลูกค้า')

  // ── Customer Demographics ─────────────────────────────────────────────────
  const byGender = db.prepare(`
    SELECT gender, COUNT(*) AS count
    FROM customers
    WHERE COALESCE(deleted_at, '') = ''
    GROUP BY gender
    ORDER BY count DESC
  `).all() as any[]

  const bySource = db.prepare(`
    SELECT source, COUNT(*) AS count
    FROM customers
    WHERE COALESCE(deleted_at, '') = ''
    GROUP BY source
    ORDER BY count DESC
  `).all() as any[]

  const byAgeGroup = db.prepare(`
    SELECT
      CASE
        WHEN birthday = '' THEN 'ไม่ระบุ'
        WHEN CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER) < 20 THEN 'ต่ำกว่า 20'
        WHEN CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER) < 30 THEN '20-29'
        WHEN CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER) < 40 THEN '30-39'
        WHEN CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER) < 50 THEN '40-49'
        WHEN CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER) < 60 THEN '50-59'
        ELSE '60+'
      END AS age_group,
      COUNT(*) AS count
    FROM customers
    WHERE COALESCE(deleted_at, '') = ''
    GROUP BY age_group
    ORDER BY count DESC
  `).all() as any[]

  const missingBirthday = db.prepare(
    `SELECT COUNT(*) AS n FROM customers WHERE COALESCE(deleted_at, '') = '' AND birthday = ''`
  ).get() as any

  if (missingBirthday.n > 0)
    warnings.push(`ลูกค้า ${missingBirthday.n} คนไม่มีข้อมูลวันเกิด`)

  const byOccupation = db.prepare(`
    SELECT CASE WHEN occupation = '' THEN 'ไม่ระบุ' ELSE occupation END AS occupation,
           COUNT(*) AS count
    FROM customers
    WHERE COALESCE(deleted_at, '') = ''
    GROUP BY occupation
    ORDER BY count DESC
  `).all() as any[]

  const missingOccupation = db.prepare(
    `SELECT COUNT(*) AS n FROM customers WHERE COALESCE(deleted_at, '') = '' AND occupation = ''`
  ).get() as any

  if (missingOccupation.n > 0)
    warnings.push(`ลูกค้า ${missingOccupation.n} คนไม่มีข้อมูลอาชีพ — การวิเคราะห์เลนส์ตามอาชีพ (Phase 6) จะไม่ครบ`)

  // ── Monthly Revenue (last 6 months) ──────────────────────────────────────
  const revenueByMonth = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      COUNT(*) AS orderCount,
      ROUND(SUM(total), 2) AS revenue,
      ROUND(AVG(total), 2) AS avgTicket
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all() as any[]

  // ── Order Status ──────────────────────────────────────────────────────────
  const orderStatus = db.prepare(`
    SELECT order_status AS status, COUNT(*) AS count
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
    GROUP BY order_status
    ORDER BY count DESC
  `).all() as any[]

  // ── Payment Status ────────────────────────────────────────────────────────
  const paymentStatus = db.prepare(`
    SELECT payment_status AS status, COUNT(*) AS count, ROUND(SUM(total), 2) AS totalAmount
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
    GROUP BY payment_status
    ORDER BY count DESC
  `).all() as any[]

  // ── Payment Methods ───────────────────────────────────────────────────────
  const paymentMethods = db.prepare(`
    SELECT method, COUNT(*) AS count, ROUND(SUM(amount), 2) AS totalAmount
    FROM payments
    WHERE COALESCE(voided_at, '') = ''
    GROUP BY method
    ORDER BY totalAmount DESC
  `).all() as any[]

  // ── Sales by Staff (staff performance) ────────────────────────────────────
  const salesByStaff = db.prepare(`
    SELECT CASE WHEN sold_by_name = '' THEN 'ไม่ระบุผู้ขาย' ELSE sold_by_name END AS staff,
           COUNT(*) AS orderCount,
           ROUND(SUM(total), 2) AS revenue
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
    GROUP BY sold_by_name
    ORDER BY revenue DESC
  `).all() as any[]

  const missingSeller = db.prepare(
    `SELECT COUNT(*) AS n FROM purchases WHERE COALESCE(voided_at, '') = '' AND sold_by_name = ''`
  ).get() as any

  if (missingSeller.n > 0)
    warnings.push(`การขาย ${missingSeller.n} รายการไม่มีผู้ขายระบุ — รายงานผลงานพนักงานจะไม่ครบ (รายการเก่าก่อนเพิ่มฟีเจอร์นี้)`)

  // ── Lens Type Distribution (from JSON) ────────────────────────────────────
  const lensTypeDistribution = db.prepare(`
    SELECT
      COALESCE(json_extract(lens_data, '$.lens_type'), 'unknown') AS lensType,
      COUNT(*) AS count
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND json_extract(lens_data, '$.enabled') = 1
    GROUP BY lensType ORDER BY count DESC
  `).all() as any[]

  // ── Inventory Alerts ──────────────────────────────────────────────────────
  const inventoryAlerts = db.prepare(`
    SELECT name, sku, stock_current AS stock, reorder_point AS reorderPoint
    FROM products
    WHERE COALESCE(deleted_at, '') = ''
      AND stock_current <= reorder_point
    ORDER BY stock_current ASC LIMIT 20
  `).all() as any[]

  // ── Top Products ──────────────────────────────────────────────────────────
  const topProducts = db.prepare(`
    SELECT p.name, p.sku,
      COALESCE(SUM(CASE WHEN sm.type = 'sale' THEN -sm.qty ELSE 0 END), 0) AS unitsSold
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.type = 'sale'
    GROUP BY p.id ORDER BY unitsSold DESC LIMIT 10
  `).all() as any[]

  // ── Margin Summary ────────────────────────────────────────────────────────
  const margin = db.prepare(`
    SELECT
      ROUND(SUM(total), 2) AS totalRevenue,
      ROUND(SUM(COALESCE(cost_lens,0) + COALESCE(cost_frame,0) + COALESCE(cost_other,0)), 2) AS totalCost,
      ROUND(SUM(total - COALESCE(cost_lens,0) - COALESCE(cost_frame,0) - COALESCE(cost_other,0)), 2) AS grossProfit,
      COUNT(*) AS totalOrders,
      COUNT(CASE WHEN cost_lens IS NOT NULL AND cost_frame IS NOT NULL AND cost_other IS NOT NULL THEN 1 END) AS ordersWithFullCost
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
  `).get() as any

  const grossMarginPct = margin.totalRevenue > 0
    ? Math.round((margin.grossProfit / margin.totalRevenue) * 100)
    : 0

  if (margin.ordersWithFullCost < margin.totalOrders)
    warnings.push(`Orders ${margin.totalOrders - margin.ordersWithFullCost} รายการยังไม่มีข้อมูลต้นทุนครบ — margin อาจไม่แม่นยำ`)

  // ── Outstanding Payments ──────────────────────────────────────────────────
  const outstanding = db.prepare(`
    SELECT COUNT(*) AS count,
      ROUND(SUM(total - paid_amount), 2) AS totalOutstanding
    FROM purchases
    WHERE COALESCE(voided_at, '') = ''
      AND payment_status IN ('pending', 'partial')
  `).get() as any

  return {
    generatedAt: new Date().toISOString(),
    dataWarnings: warnings,
    overview: {
      totalCustomers: overview.totalCustomers,
      totalOrders: overview.totalOrders,
      totalRevenue: overview.totalRevenue,
      avgTicketSize: Math.round(overview.avgTicketSize),
      firstOrderDate: overview.firstOrderDate,
      lastOrderDate: overview.lastOrderDate,
      dataPeriodDays,
    },
    customerDemographics: {
      byGender,
      bySource,
      byAgeGroup,
      byOccupation,
      missingBirthday: missingBirthday.n,
    },
    salesByStaff,
    revenueByMonth,
    orderStatus,
    paymentStatus,
    paymentMethods,
    lensTypeDistribution,
    inventoryAlerts,
    topProducts,
    marginSummary: {
      totalRevenue: margin.totalRevenue ?? 0,
      totalCost: margin.totalCost ?? 0,
      grossProfit: margin.grossProfit ?? 0,
      grossMarginPct,
      ordersWithFullCost: margin.ordersWithFullCost,
      totalOrders: margin.totalOrders,
    },
    outstandingPayments: {
      count: outstanding.count,
      totalOutstanding: outstanding.totalOutstanding ?? 0,
    },
  }
}
