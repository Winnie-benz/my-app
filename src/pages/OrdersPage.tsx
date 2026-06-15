import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ChevronRight, Search, RotateCcw, Trash2, ShieldAlert, History, X } from 'lucide-react'
import { useCustomerStore } from '../store/useCustomerStore'
import { api } from '../services/api'
import type { OrderStatus, Claim, PurchaseRecord, OrderStatusLog } from '../types/customer'
import { useEscapeKey } from '../hooks/useEscapeKey'

const STATUS_TABS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'ทั้งหมด'    },
  { key: 'waiting',   label: 'รอกรอบ / เลนส์' },
  { key: 'arrived',   label: 'สินค้ามาถึง' },
  { key: 'cutting',   label: 'กำลังตัด'  },
  { key: 'ready',     label: 'พร้อมรับ'  },
  { key: 'completed', label: 'เสร็จแล้ว' },
]

const STATUS_CLS: Record<OrderStatus, string> = {
  waiting:   'bg-slate-100 text-slate-600',
  arrived:   'bg-blue-100 text-blue-700',
  cutting:   'bg-amber-100 text-amber-700',
  ready:     'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-400',
}

const STATUS_LABEL: Record<OrderStatus | '', string> = {
  '': 'เริ่มต้น',
  waiting: 'รอกรอบ / เลนส์',
  arrived: 'สินค้ามาถึง',
  cutting: 'กำลังตัด',
  ready: 'พร้อมรับ',
  completed: 'เสร็จแล้ว',
}

const CLAIM_TYPE_LABEL: Record<string, string> = {
  broken_frame:   'กรอบแตก/หัก',
  scratched_lens: 'เลนส์ขูดขีด',
  rx_change:      'ค่าสายตาเปลี่ยน',
  adjustment:     'ปรับกรอบ',
  other:          'อื่นๆ',
}

type OrderRow =
  | { kind: 'purchase'; data: PurchaseRecord; pickup: string; status: OrderStatus }
  | { kind: 'claim';    data: Claim;          pickup: string; status: OrderStatus }

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function pickupBadge(pickupDate: string): { label: string; cls: string } | null {
  if (!pickupDate) return null
  const n = daysUntil(pickupDate)
  if (n < 0)  return { label: `เกิน ${-n} วัน`, cls: 'bg-red-100 text-red-600' }
  if (n === 0) return { label: 'วันนี้', cls: 'bg-green-100 text-green-700 font-semibold' }
  if (n <= 3)  return { label: `เหลือ ${n} วัน`, cls: 'bg-amber-100 text-amber-700' }
  return { label: `เหลือ ${n} วัน`, cls: 'bg-slate-100 text-slate-500' }
}

export default function OrdersPage() {
  const navigate   = useNavigate()
  const customers         = useCustomerStore(s => s.customers)
  const purchases         = useCustomerStore(s => s.purchases)
  const updateOrderStatus = useCustomerStore(s => s.updateOrderStatus)
  const deletePurchase    = useCustomerStore(s => s.deletePurchase)

  const [statusTab, setStatusTab] = useState<OrderStatus | 'all'>('all')
  const [search,    setSearch]    = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [claims,    setClaims]    = useState<Claim[]>([])
  const [historyTitle, setHistoryTitle] = useState('')
  const [historyLogs, setHistoryLogs] = useState<OrderStatusLog[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    api.claims.list().then(r => setClaims(r.data)).catch(() => {})
  }, [])

  useEscapeKey(useCallback(() => setConfirmDelete(null), []), confirmDelete !== null)
  useEscapeKey(useCallback(() => setHistoryOpen(false), []), historyOpen)

  function claimOrderStatus(claim: Claim): OrderStatus {
    return claim.order_status ?? (claim.status === 'resolved' ? 'completed' : claim.status === 'in_progress' ? 'cutting' : 'waiting')
  }

  async function handleClaimOrderStatus(id: string, orderStatus: OrderStatus) {
    try {
      const res = await api.claims.update(id, { order_status: orderStatus })
      setClaims(prev => prev.map(c => c.id === id ? res.data : c))
      window.dispatchEvent(new Event('claims-updated'))
    } catch { /* empty */ }
  }

  async function openStatusHistory(row: OrderRow) {
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryLogs([])
    try {
      if (row.kind === 'purchase') {
        const customer = customerMap[row.data.customer_id]
        setHistoryTitle(customer ? `${customer.first_name} ${customer.last_name}` : row.data.customer_id)
        const res = await api.purchases.statusLogs(row.data.id)
        setHistoryLogs(res.data)
      } else {
        setHistoryTitle(`${row.data.first_name ?? ''} ${row.data.last_name ?? ''}`.trim() || row.data.customer_id)
        const res = await api.claims.statusLogs(row.data.id)
        setHistoryLogs(res.data)
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  const customerMap = useMemo(() =>
    Object.fromEntries(customers.map(c => [c.customer_id, c])),
  [customers])

  const filtered = useMemo((): OrderRow[] => {
    const q = search.trim().toLowerCase()

    const purchaseRows: OrderRow[] = purchases
      .filter(p => {
        if (statusTab !== 'all' && p.order_status !== statusTab) return false
        if (q) {
          const c = customerMap[p.customer_id]
          const name  = c ? `${c.first_name} ${c.last_name}`.toLowerCase() : ''
          const phone = c?.phone_no?.toLowerCase() ?? ''
          if (!name.includes(q) && !phone.includes(q)) return false
        }
        return true
      })
      .map(p => ({ kind: 'purchase' as const, data: p, pickup: p.pickup_date, status: p.order_status }))

    const claimRows: OrderRow[] = claims
      .filter(c => {
        const orderStatus = claimOrderStatus(c)
        if (statusTab !== 'all' && orderStatus !== statusTab) return false
        if (!q) return true
        const name  = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
        const phone = c.phone_no?.toLowerCase() ?? ''
        return name.includes(q) || phone.includes(q)
      })
      .map(c => ({ kind: 'claim' as const, data: c, pickup: c.pickup_date, status: claimOrderStatus(c) }))

    return [...purchaseRows, ...claimRows].sort((a, b) => {
      const dA = a.pickup ? new Date(a.pickup).getTime() : Infinity
      const dB = b.pickup ? new Date(b.pickup).getTime() : Infinity
      return dA - dB
    })
  }, [purchases, claims, statusTab, search, customerMap])

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = { all: purchases.length + claims.length }
    for (const p of purchases) {
      map[p.order_status] = (map[p.order_status] ?? 0) + 1
    }
    for (const c of claims) {
      const orderStatus = claimOrderStatus(c)
      map[orderStatus] = (map[orderStatus] ?? 0) + 1
    }
    return map
  }, [purchases, claims])

  const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
    waiting: 'arrived',
    arrived: 'cutting',
    cutting: 'ready',
    ready:   'completed',
  }
  const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
    waiting: 'มาถึงแล้ว',
    arrived: 'เริ่มตัด',
    cutting: 'ตัดเสร็จ',
    ready:   'รับแล้ว',
  }
  const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
    arrived:   'waiting',
    cutting:   'arrived',
    ready:     'cutting',
    completed: 'ready',
  }
  const PREV_LABEL: Partial<Record<OrderStatus, string>> = {
    arrived:   'ย้อนกลับ',
    cutting:   'ย้อนกลับ',
    ready:     'ย้อนกลับ',
    completed: 'ย้อนกลับ',
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList size={20} className="text-slate-700" />
        <h1 className="text-xl font-semibold text-slate-900">รายการ Orders</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {STATUS_TABS.map(tab => {
          const count = countByStatus[tab.key] ?? 0
          const active = statusTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                  active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-400">ไม่มีรายการ</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ลูกค้า</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">วันที่ซื้อ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">นัดรับ</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-44">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                if (row.kind === 'purchase') {
                  const p    = row.data
                  const cust = customerMap[p.customer_id]
                  const badge = pickupBadge(p.pickup_date)
                  const nextStatus = NEXT_STATUS[p.order_status]
                  const nextLabel  = NEXT_LABEL[p.order_status]
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <button type="button" onClick={() => navigate(`/customers/${p.customer_id}`)} className="text-left hover:underline">
                          <p className="font-medium text-slate-900">{cust ? `${cust.first_name} ${cust.last_name}` : p.customer_id}</p>
                          {cust?.phone_no && <p className="text-xs text-slate-400 mt-0.5">{cust.phone_no}</p>}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-slate-700 tabular-nums">{p.date}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {p.pickup_date ? (
                          <>
                            <p className="text-xs text-slate-700 tabular-nums">{p.pickup_date}</p>
                            {badge && <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>}
                          </>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {nextStatus && nextLabel && (
                            <button type="button" onClick={() => updateOrderStatus(p.id, nextStatus)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              {nextLabel} <ChevronRight size={12} />
                            </button>
                          )}
                          <button type="button" onClick={() => openStatusHistory(row)} title="ประวัติสถานะ"
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors">
                            <History size={11} />
                          </button>
                          {PREV_STATUS[p.order_status] && (
                            <button type="button" onClick={() => updateOrderStatus(p.id, PREV_STATUS[p.order_status]!)}
                              title="ย้อนกลับ"
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors">
                              <RotateCcw size={11} />
                            </button>
                          )}
                          {p.order_status === 'completed' && (
                            <button type="button" onClick={() => setConfirmDelete(p.id)} title="ลบรายการ"
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }

                // claim row
                const c = row.data
                const badge = pickupBadge(c.pickup_date)
                const orderStatus = row.status
                const nextStatus = NEXT_STATUS[orderStatus]
                const nextLabel  = NEXT_LABEL[orderStatus]
                return (
                  <tr key={`claim-${c.id}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button type="button" onClick={() => navigate(`/customers/${c.customer_id}`)} className="text-left hover:underline">
                        <p className="font-medium text-slate-900">{c.first_name} {c.last_name}</p>
                        {c.phone_no && <p className="text-xs text-slate-400 mt-0.5">{c.phone_no}</p>}
                      </button>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        <ShieldAlert size={9} />
                        เคลม{c.claim_type ? ` · ${CLAIM_TYPE_LABEL[c.claim_type] ?? c.claim_type}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-700 tabular-nums">{c.purchase_date ?? c.created_at.slice(0, 10)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.pickup_date ? (
                        <>
                          <p className="text-xs text-slate-700 tabular-nums">{c.pickup_date}</p>
                          {badge && <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>}
                        </>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {nextStatus && nextLabel && (
                          <button type="button" onClick={() => handleClaimOrderStatus(c.id, nextStatus)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            {nextLabel} <ChevronRight size={12} />
                          </button>
                        )}
                        {PREV_STATUS[orderStatus] && (
                          <button type="button"
                            onClick={() => handleClaimOrderStatus(c.id, PREV_STATUS[orderStatus]!)}
                            title="ย้อนกลับ"
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors">
                            <RotateCcw size={11} />
                          </button>
                        )}
                        <button type="button" onClick={() => openStatusHistory(row)} title="ประวัติสถานะ"
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors">
                          <History size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation popup */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600">
              ลบรายการนี้ออกจากระบบ? ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="button"
                onClick={() => {
                  const p = purchases.find(x => x.id === confirmDelete)
                  if (p) deletePurchase(p.id, p.customer_id)
                  setConfirmDelete(null)
                }}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600 transition-colors">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h3 className="font-semibold text-slate-900">ประวัติสถานะ</h3>
                <p className="text-xs text-slate-400 mt-0.5">{historyTitle}</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5">
              {historyLoading ? (
                <p className="text-sm text-slate-400 text-center py-8">กำลังโหลด...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีประวัติการเปลี่ยนสถานะ</p>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map(log => (
                    <div key={log.id} className="border border-slate-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.from_status ? STATUS_CLS[log.from_status] : 'bg-slate-100 text-slate-400'}`}>
                          {STATUS_LABEL[log.from_status]}
                        </span>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[log.to_status]}`}>
                          {STATUS_LABEL[log.to_status]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2 text-xs text-slate-400">
                        <span>{log.changed_by || 'ไม่ระบุผู้ใช้'}</span>
                        <span className="tabular-nums">{log.changed_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
