import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Plus, Search, ChevronRight, Trash2, CheckCircle2, RotateCcw, CreditCard } from 'lucide-react'
import { api } from '../services/api'
import type { Claim, ClaimStatus } from '../types/customer'
import ClaimFormModal from '../components/customers/ClaimFormModal'
import ClaimPaymentModal from '../components/customers/ClaimPaymentModal'
import { useEscapeKey } from '../hooks/useEscapeKey'

function pickupBadge(d: string): { label: string; cls: string } | null {
  if (!d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const date  = new Date(d); date.setHours(0, 0, 0, 0)
  const n = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (n < 0)   return { label: `เกิน ${-n} วัน`, cls: 'bg-red-100 text-red-600' }
  if (n === 0) return { label: 'วันนี้', cls: 'bg-green-100 text-green-700 font-semibold' }
  if (n <= 3)  return { label: `เหลือ ${n} วัน`, cls: 'bg-amber-100 text-amber-700' }
  return { label: `เหลือ ${n} วัน`, cls: 'bg-slate-100 text-slate-500' }
}

const CLAIM_TYPE_LABEL: Record<string, string> = {
  broken_frame:   'กรอบแตก/หัก',
  scratched_lens: 'เลนส์ขูดขีด',
  rx_change:      'ค่าสายตาเปลี่ยน',
  adjustment:     'ปรับกรอบ',
  other:          'อื่นๆ',
}

const STATUS_TABS: { key: ClaimStatus | 'all'; label: string }[] = [
  { key: 'all',         label: 'ทั้งหมด'        },
  { key: 'pending',     label: 'รอดำเนินการ'    },
  { key: 'in_progress', label: 'กำลังดำเนินการ' },
  { key: 'resolved',    label: 'เสร็จแล้ว'      },
]

const STATUS_CLS: Record<ClaimStatus, string> = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved:    'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<ClaimStatus, string> = {
  pending:     'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  resolved:    'เสร็จแล้ว',
}

export default function ClaimsPage() {
  const navigate = useNavigate()
  const [claims,          setClaims]          = useState<Claim[]>([])
  const [loading,         setLoading]         = useState(true)
  const [tab,             setTab]             = useState<ClaimStatus | 'all'>('all')
  const [search,          setSearch]          = useState('')
  const [formOpen,        setFormOpen]        = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [payingClaim,     setPayingClaim]     = useState<Claim | null>(null)

  useEscapeKey(useCallback(() => setFormOpen(false), []),       formOpen)
  useEscapeKey(useCallback(() => setConfirmDeleteId(null), []), confirmDeleteId !== null)
  useEscapeKey(useCallback(() => setPayingClaim(null), []),     payingClaim !== null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.claims.list()
      setClaims(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleStatusUpdate(id: string, status: ClaimStatus) {
    try {
      const res = await api.claims.update(id, { status })
      setClaims(prev => prev.map(c => c.id === id ? res.data : c))
      window.dispatchEvent(new Event('claims-updated'))
    } catch { /* empty */ }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return
    try {
      await api.claims.remove(confirmDeleteId)
      setClaims(prev => prev.filter(c => c.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch { /* empty */ }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return claims.filter(c => {
      if (tab !== 'all' && c.status !== tab) return false
      if (q) {
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
        const phone = c.phone_no?.toLowerCase() ?? ''
        if (!name.includes(q) && !phone.includes(q)) return false
      }
      return true
    })
  }, [claims, tab, search])

  const countByTab = useMemo(() => {
    const m: Record<string, number> = { all: claims.length }
    for (const c of claims) m[c.status] = (m[c.status] ?? 0) + 1
    return m
  }, [claims])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert size={20} className="text-slate-700" />
          <h1 className="text-xl font-semibold text-slate-900">การเคลม / ประกัน</h1>
        </div>
        <button type="button" onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus size={15} />
          เพิ่มการเคลม
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {STATUS_TABS.map(t => {
          const count = countByTab[t.key] ?? 0
          const active = tab === t.key
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {t.label}
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
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-16">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <ShieldAlert size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">ไม่มีรายการเคลม</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ลูกค้า</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">วันที่เคลม</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">นัดรับ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">ประเภท</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">รายละเอียด</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">สถานะ</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-52">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <button type="button" onClick={() => navigate(`/customers/${c.customer_id}`)}
                      className="text-left hover:underline">
                      <p className="font-medium text-slate-900">{c.first_name ?? ''} {c.last_name ?? ''}</p>
                      {c.phone_no && <p className="text-xs text-slate-400 mt-0.5">{c.phone_no}</p>}
                    </button>
                    {c.purchase_date && (
                      <p className="text-[10px] text-slate-400 mt-0.5">ซื้อ {c.purchase_date}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-slate-700 tabular-nums">{c.created_at.slice(0, 10)}</p>
                    {c.resolved_at && (
                      <p className="text-[10px] text-slate-400 mt-0.5">เสร็จ {c.resolved_at.slice(0, 10)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {c.pickup_date ? (() => {
                      const b = pickupBadge(c.pickup_date)
                      return (
                        <>
                          <p className="text-xs text-slate-700 tabular-nums">{c.pickup_date}</p>
                          {b && <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${b.cls}`}>{b.label}</span>}
                        </>
                      )
                    })() : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-600 whitespace-nowrap">
                      {CLAIM_TYPE_LABEL[c.claim_type] ?? (c.claim_type || '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-slate-500 line-clamp-2">{c.description || '—'}</p>
                    {c.fee > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-[10px] text-slate-400">฿{c.fee.toLocaleString()}</p>
                        {c.payment_status === 'paid' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">ชำระแล้ว</span>
                        ) : c.payment_status === 'partial' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">ชำระบางส่วน</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">ค้างชำระ</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CLS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.fee > 0 && c.payment_status !== 'paid' && (
                        <button type="button"
                          onClick={() => setPayingClaim(c)}
                          title="บันทึกชำระเงิน"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          <CreditCard size={11} /> ชำระ
                        </button>
                      )}
                      {c.status === 'pending' && (
                        <button type="button"
                          onClick={() => handleStatusUpdate(c.id, 'in_progress')}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          เริ่มดำเนินการ <ChevronRight size={12} />
                        </button>
                      )}
                      {c.status === 'in_progress' && (
                        <button type="button"
                          onClick={() => handleStatusUpdate(c.id, 'resolved')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          <CheckCircle2 size={12} /> เสร็จแล้ว
                        </button>
                      )}
                      {(c.status === 'in_progress' || c.status === 'resolved') && (
                        <button type="button"
                          onClick={() => handleStatusUpdate(c.id, c.status === 'resolved' ? 'in_progress' : 'pending')}
                          title="ย้อนกลับ"
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors">
                          <RotateCcw size={11} />
                        </button>
                      )}
                      <button type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        title="ลบรายการเคลม"
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <ClaimFormModal
          onSaved={() => { setFormOpen(false); load() }}
          onClose={() => setFormOpen(false)}
        />
      )}

      {payingClaim && (
        <ClaimPaymentModal
          claim={payingClaim}
          onClose={() => setPayingClaim(null)}
          onUpdated={updated => {
            setClaims(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
            setPayingClaim(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
          }}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 size={16} className="text-red-500" />
              <h3 className="font-semibold text-slate-900">ยืนยันการลบ</h3>
            </div>
            <p className="text-sm text-slate-600">ต้องการลบรายการเคลมนี้ใช่หรือไม่? ไม่สามารถกู้คืนได้</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={handleDelete}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600 transition-colors">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
