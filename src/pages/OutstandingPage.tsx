import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { Wallet, ShieldAlert } from 'lucide-react'
import type { Claim, PurchaseRecord } from '../types/customer'
import ClaimPaymentModal from '../components/customers/ClaimPaymentModal'
import PaymentModal from '../components/customers/PaymentModal'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface OutstandingItem {
  purchase: PurchaseRecord
  customer: { customer_id: string; first_name: string; last_name: string; phone_no: string }
  last_payment_date: string | null
}

const PURCHASE_STATUS_LABEL: Record<string, string> = { pending: 'ค้างชำระ', partial: 'มัดจำ' }
const PURCHASE_STATUS_CLS:  Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
}

const CLAIM_TYPE_LABEL: Record<string, string> = {
  broken_frame: 'กรอบแตก/หัก', scratched_lens: 'เลนส์ขูดขีด',
  rx_change: 'ค่าสายตาเปลี่ยน', adjustment: 'ปรับกรอบ', other: 'อื่นๆ',
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function OutstandingPage() {
  const navigate = useNavigate()
  const [items,       setItems]       = useState<OutstandingItem[]>([])
  const [claimItems,  setClaimItems]  = useState<Claim[]>([])
  const [loading,     setLoading]     = useState(true)
  const [payingPurchase, setPayingPurchase] = useState<OutstandingItem | null>(null)
  const [payingClaim, setPayingClaim] = useState<Claim | null>(null)

  useEscapeKey(useCallback(() => setPayingPurchase(null), []), payingPurchase !== null)
  useEscapeKey(useCallback(() => setPayingClaim(null), []), payingClaim !== null)

  useEffect(() => {
    Promise.all([
      api.purchases.outstanding(),
      api.claims.outstanding(),
    ]).then(([p, c]) => {
      setItems(p.data)
      setClaimItems(c.data)
    }).finally(() => setLoading(false))
  }, [])

  const purchaseOutstanding = items.reduce((s, i) => s + (i.purchase.total - i.purchase.paid_amount), 0)
  const claimOutstanding    = claimItems.reduce((s, c) => s + (c.fee - c.paid_amount), 0)
  const totalOutstanding    = purchaseOutstanding + claimOutstanding

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Wallet size={20} className="text-slate-700" />
          <h1 className="text-xl font-semibold text-slate-900">รายการค้างชำระ</h1>
          {(items.length + claimItems.length) > 0 && (
            <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {items.length + claimItems.length} รายการ
            </span>
          )}
        </div>
        {totalOutstanding > 0 && (
          <p className="text-sm text-slate-500">
            ยอดค้างรวม{' '}
            <span className="font-semibold text-red-600">฿{totalOutstanding.toLocaleString()}</span>
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-16">กำลังโหลด...</p>
      ) : (items.length === 0 && claimItems.length === 0) ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-sm font-medium text-slate-700">ไม่มียอดค้างชำระ</p>
        </div>
      ) : (
        <>
          {/* Purchase outstanding */}
          {items.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 mb-2">รายการขาย</h2>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ลูกค้า</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">วันที่ซื้อ</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ชำระล่าสุด</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ยอดรวม</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ชำระแล้ว</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ค้างอยู่</th>
                      <th className="px-5 py-3 w-24 text-xs font-semibold text-slate-400 uppercase tracking-wider">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const outstanding = item.purchase.total - item.purchase.paid_amount
                      return (
                        <tr
                          key={item.purchase.id}
                          onClick={() => navigate(`/customers/${item.customer.customer_id}`)}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-900">
                              {item.customer.first_name} {item.customer.last_name}
                            </p>
                            {item.customer.phone_no && (
                              <p className="text-xs text-slate-400 mt-0.5">{item.customer.phone_no}</p>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${PURCHASE_STATUS_CLS[item.purchase.payment_status]}`}>
                              {PURCHASE_STATUS_LABEL[item.purchase.payment_status]}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-slate-700">{item.purchase.date}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{daysSince(item.purchase.date)} วันที่แล้ว</p>
                          </td>
                          <td className="px-4 py-4 text-slate-500 text-xs">
                            {item.last_payment_date ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 tabular-nums">
                            ฿{item.purchase.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-green-600 tabular-nums">
                            ฿{item.purchase.paid_amount.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-red-600 tabular-nums">
                            ฿{outstanding.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setPayingPurchase(item)
                              }}
                              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
                            >
                              ชำระ
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Claim fees outstanding */}
          {claimItems.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-2">
                <ShieldAlert size={14} />
                ค่าบริการเคลม
              </h2>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ลูกค้า</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">วันที่เคลม</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ชำระล่าสุด</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ยอดรวม</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ชำระแล้ว</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ค้างอยู่</th>
                      <th className="px-5 py-3 w-24 text-xs font-semibold text-slate-400 uppercase tracking-wider">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimItems.map(c => {
                      const claimRemaining = c.fee - c.paid_amount
                      return (
                        <tr
                          key={c.id}
                          onClick={() => navigate(`/customers/${c.customer_id}`)}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="text-left">
                              <p className="font-medium text-slate-900">{c.first_name} {c.last_name}</p>
                              {c.phone_no && <p className="text-xs text-slate-400 mt-0.5">{c.phone_no}</p>}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${
                                c.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {c.payment_status === 'partial' ? 'ชำระบางส่วน' : 'ค้างชำระ'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 ml-1 inline-block bg-slate-100 text-slate-600">
                              {CLAIM_TYPE_LABEL[c.claim_type] ?? (c.claim_type || '—')}
                              </span>
                            </div>
                            {c.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-slate-700">{c.created_at.slice(0, 10)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{daysSince(c.created_at.slice(0, 10))} วันที่แล้ว</p>
                          </td>
                          <td className="px-4 py-4 text-slate-500 text-xs">
                            {c.last_payment_date ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-700 tabular-nums">
                            ฿{c.fee.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-green-600 tabular-nums">
                            ฿{c.paid_amount.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-red-600 tabular-nums">
                            ฿{claimRemaining.toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setPayingClaim(c)
                              }}
                              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap">
                              ชำระ
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {payingPurchase && (
        <PaymentModal
          record={payingPurchase.purchase}
          onClose={() => setPayingPurchase(null)}
          onUpdated={updated => {
            const nextItem = { ...payingPurchase, purchase: updated }
            setItems(prev =>
              updated.payment_status === 'paid'
                ? prev.filter(item => item.purchase.id !== updated.id)
                : prev.map(item => item.purchase.id === updated.id ? nextItem : item)
            )
            setPayingPurchase(updated.payment_status === 'paid' ? null : nextItem)
          }}
        />
      )}

      {payingClaim && (
        <ClaimPaymentModal
          claim={payingClaim}
          onClose={() => setPayingClaim(null)}
          onUpdated={updated => {
            setClaimItems(prev =>
              updated.payment_status === 'paid'
                ? prev.filter(c => c.id !== updated.id)
                : prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)
            )
            setPayingClaim(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
          }}
        />
      )}
    </div>
  )
}
