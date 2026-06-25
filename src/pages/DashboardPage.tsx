import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Clock,
  PackageSearch, Target, TrendingUp, User,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCustomerStore } from '../store/useCustomerStore'
import { useProductStore } from '../store/useProductStore'
import { api } from '../services/api'
import type { Claim, OrderStatus } from '../types/customer'

function localDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE')
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function dueLabel(dateStr: string) {
  const d = daysUntil(dateStr)
  if (d === null) return { label: '—', cls: 'bg-slate-100 text-slate-500' }
  if (d < 0) return { label: `เกิน ${-d} วัน`, cls: 'bg-red-100 text-red-600' }
  if (d === 0) return { label: 'วันนี้', cls: 'bg-red-100 text-red-600' }
  if (d === 1) return { label: 'พรุ่งนี้', cls: 'bg-amber-100 text-amber-600' }
  if (d <= 3) return { label: `เหลือ ${d} วัน`, cls: 'bg-amber-100 text-amber-700' }
  return { label: dateStr, cls: 'bg-slate-100 text-slate-600' }
}

const STATUS_CHIP: Record<OrderStatus, { label: string; cls: string }> = {
  waiting:   { label: 'รอกรอบ / เลนส์', cls: 'bg-slate-100 text-slate-600' },
  arrived:   { label: 'สินค้ามาถึงแล้ว', cls: 'bg-blue-100 text-blue-700' },
  cutting:   { label: 'กำลังตัดเลนส์', cls: 'bg-amber-100 text-amber-700' },
  ready:     { label: 'พร้อมรับสินค้า', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'เสร็จแล้ว', cls: 'bg-slate-100 text-slate-400' },
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  waiting: 'arrived',
  arrived: 'cutting',
  cutting: 'ready',
  ready: 'completed',
}
const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  arrived: 'waiting',
  cutting: 'arrived',
  ready: 'cutting',
  completed: 'ready',
}
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  waiting: 'มาถึงแล้ว',
  arrived: 'เริ่มตัด',
  cutting: 'ตัดเสร็จ',
  ready: 'รับแล้ว',
}

const CLAIM_TYPE_LABEL: Record<string, string> = {
  broken_frame: 'กรอบแตก/หัก',
  scratched_lens: 'เลนส์ขูดขีด',
}

function claimOrderStatus(claim: Claim): OrderStatus {
  return claim.order_status ?? (claim.status === 'resolved' ? 'completed' : claim.status === 'in_progress' ? 'cutting' : 'waiting')
}

type PickupTask = {
  id: string
  kind: 'purchase' | 'claim'
  customerId: string
  customerName: string
  phone?: string
  pickupDate: string
  pickupTime?: string
  status: OrderStatus
  subtitle: string
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const purchases = useCustomerStore(s => s.purchases)
  const customers = useCustomerStore(s => s.customers)
  const updateOrderStatus = useCustomerStore(s => s.updateOrderStatus)
  const products = useProductStore(s => s.products)
  const [claims, setClaims] = useState<Claim[]>([])

  useEffect(() => {
    function loadClaims() {
      api.claims.list().then(r => setClaims(r.data)).catch(() => {})
    }
    loadClaims()
    window.addEventListener('claims-updated', loadClaims)
    return () => window.removeEventListener('claims-updated', loadClaims)
  }, [])

  async function updateClaimStatus(id: string, status: OrderStatus) {
    const res = await api.claims.update(id, { order_status: status })
    setClaims(prev => prev.map(c => c.id === id ? res.data : c))
    window.dispatchEvent(new Event('claims-updated'))
  }

  const customerMap = useMemo(() =>
    Object.fromEntries(customers.map(c => [c.customer_id, c])),
  [customers])

  const todayStr   = localDateStr()
  const monthStr   = todayStr.slice(0, 7)

  const monthlySales = useMemo(() =>
    purchases.filter(p => p.date.startsWith(monthStr)).reduce((s, p) => s + p.total, 0),
  [purchases, monthStr])

  const todaySales = useMemo(() => ({
    count:   purchases.filter(p => p.date === todayStr).length,
    revenue: purchases.filter(p => p.date === todayStr).reduce((s, p) => s + p.total, 0),
  }), [purchases, todayStr])

  const outstanding = useMemo(() =>
    purchases
      .filter(p => p.payment_status === 'pending' || p.payment_status === 'partial')
      .reduce((s, p) => s + (p.total - p.paid_amount), 0),
  [purchases])

  const activeOrders = useMemo(() =>
    purchases.filter(p => p.order_status !== 'completed').length,
  [purchases])

  const salesTarget = Number(localStorage.getItem('monthly_sales_target') || '100000')
  const targetPct   = salesTarget > 0 ? Math.round((monthlySales / salesTarget) * 100) : 0

  const lowStock = useMemo(() =>
    products
      .filter(p => p.stock_current <= (p.reorder_point ?? 1) && !p.low_stock_ignored)
      .sort((a, b) => a.stock_current - b.stock_current)
      .slice(0, 8),
  [products])

  const pickupTasks = useMemo<PickupTask[]>(() => {
    const in3Days = localDateStr(3)

    const purchaseTasks: PickupTask[] = purchases
      .filter(p => p.pickup_date && p.order_status !== 'completed' && p.pickup_date <= in3Days)
      .map(p => {
        const c = customerMap[p.customer_id]
        const items = [
          p.lens.enabled && 'เลนส์',
          p.frame.enabled && 'กรอบ',
          p.other.enabled && 'สินค้าอื่นๆ',
        ].filter(Boolean).join(' · ')
        return {
          id: p.id,
          kind: 'purchase',
          customerId: p.customer_id,
          customerName: c ? `${c.first_name} ${c.last_name}` : `ลูกค้า #${p.customer_id}`,
          phone: c?.phone_no,
          pickupDate: p.pickup_date,
          pickupTime: p.pickup_time,
          status: p.order_status,
          subtitle: items || 'รายการขาย',
        }
      })

    const claimTasks: PickupTask[] = claims
      .filter(c => c.pickup_date && claimOrderStatus(c) !== 'completed' && c.pickup_date <= in3Days)
      .map(c => ({
        id: c.id,
        kind: 'claim',
        customerId: c.customer_id,
        customerName: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || `ลูกค้า #${c.customer_id}`,
        phone: c.phone_no,
        pickupDate: c.pickup_date,
        status: claimOrderStatus(c),
        subtitle: `เคลม/ประกัน${c.claim_type ? ` · ${CLAIM_TYPE_LABEL[c.claim_type] ?? c.claim_type}` : ''}`,
      }))

    return [...purchaseTasks, ...claimTasks].sort((a, b) => {
      const dueA = daysUntil(a.pickupDate) ?? 999
      const dueB = daysUntil(b.pickupDate) ?? 999
      if (dueA !== dueB) return dueA - dueB
      return a.pickupDate.localeCompare(b.pickupDate)
    })
  }, [purchases, claims, customerMap])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">ST</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            สวัสดี, {user?.nickname || user?.first_name}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">งานที่ต้องจัดการวันนี้และเร็ว ๆ นี้</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<User size={15} />}
          label="ยอดขายวันนี้"
          value={todaySales.count > 0 ? `฿${fmt(todaySales.revenue)}` : '—'}
          sub={todaySales.count > 0 ? `${todaySales.count} รายการ` : 'ยังไม่มีรายการวันนี้'}
        />
        <KpiCard
          icon={<TrendingUp size={15} />}
          label="ยอดขายเดือนนี้"
          value={`฿${fmt(monthlySales)}`}
          sub={`${targetPct}% ของเป้า ฿${fmt(salesTarget)}`}
        />
        <KpiCard
          icon={<Target size={15} />}
          label="คงเหลือถึงเป้า"
          value={monthlySales >= salesTarget ? 'บรรลุเป้า' : `฿${fmt(salesTarget - monthlySales)}`}
          sub={monthStr}
        />
        <KpiCard
          icon={<PackageSearch size={15} />}
          label="รายการที่กำลังดำเนินการ"
          value={`${activeOrders}`}
          sub="orders ยังไม่เสร็จ"
        />
        <KpiCard
          icon={<Clock size={15} />}
          label="ค้างชำระรวม"
          value={outstanding > 0 ? `฿${fmt(outstanding)}` : '—'}
          sub={outstanding > 0 ? 'รวมทุกรายการ' : 'ไม่มียอดค้างชำระ'}
        />
        <KpiCard
          icon={<AlertTriangle size={15} />}
          label="สต็อกต่ำ"
          value={`${lowStock.length}`}
          sub="รายการที่ควรเติม"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">นัดรับใกล้ถึง / เลยกำหนด</h2>
            {pickupTasks.length > 0 && (
              <span className="ml-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pickupTasks.length}
              </span>
            )}
          </div>

          {pickupTasks.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center text-slate-400 text-sm">
              ไม่มีนัดรับที่ต้องตามใน 3 วัน
            </div>
          ) : (
            <div className="space-y-3">
              {pickupTasks.map(task => {
                const chip = STATUS_CHIP[task.status]
                const nextSt = NEXT_STATUS[task.status]
                const prevSt = PREV_STATUS[task.status]
                const due = dueLabel(task.pickupDate)

                return (
                  <div key={`${task.kind}-${task.id}`} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => navigate(`/customers/${task.customerId}`)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            <User size={14} className="text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-slate-900 text-sm">{task.customerName}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${chip.cls}`}>
                                {chip.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {task.subtitle}{task.phone ? ` · ${task.phone}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${due.cls}`}>
                            {due.label}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">
                            {task.pickupDate}{task.pickupTime ? ` · ${task.pickupTime}` : ''}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="px-5 pb-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      {prevSt && (
                        <button
                          type="button"
                          onClick={() => task.kind === 'purchase'
                            ? updateOrderStatus(task.id, prevSt)
                            : updateClaimStatus(task.id, prevSt)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <ChevronLeft size={13} />
                          ย้อนกลับ
                        </button>
                      )}
                      {nextSt && (
                        <button
                          type="button"
                          onClick={() => task.kind === 'purchase'
                            ? updateOrderStatus(task.id, nextSt)
                            : updateClaimStatus(task.id, nextSt)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium bg-slate-900 hover:bg-slate-700 text-white"
                        >
                          {task.status === 'ready' ? <Check size={13} /> : <ChevronRight size={13} />}
                          {NEXT_LABEL[task.status]}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <PackageSearch size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">สต็อกต่ำที่ควรเติม</h2>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีสินค้าใกล้หมด</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lowStock.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.sku || p.barcode}</p>
                      </div>
                      <span className="text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-1 shrink-0">
                        เหลือ {p.stock_current}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
