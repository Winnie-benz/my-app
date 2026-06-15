import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, PlusCircle, Phone, Mail, MapPin, FileText, Eye, ShieldAlert, CreditCard } from 'lucide-react'
import { useCustomerStore } from '../store/useCustomerStore'
import CustomerForm from '../components/customers/CustomerForm'
import PurchaseCard from '../components/customers/PurchaseCard'
import PurchaseForm from '../components/customers/PurchaseForm'
import PaymentModal from '../components/customers/PaymentModal'
import ClaimFormModal from '../components/customers/ClaimFormModal'
import ClaimPaymentModal from '../components/customers/ClaimPaymentModal'
import { useEscapeKey } from '../hooks/useEscapeKey'
import type { CustomerFormData, PurchaseRecord, InitialPayment, Claim } from '../types/customer'
import { calcAge, formatDate } from '../utils/customerUtils'
import { printReceipt } from '../utils/printReceipt'
import { api } from '../services/api'

const CLAIM_TYPE_LABEL: Record<string, string> = {
  broken_frame: 'กรอบแตก/หัก', scratched_lens: 'เลนส์ขูดขีด',
  rx_change: 'ค่าสายตาเปลี่ยน', adjustment: 'ปรับกรอบ', other: 'อื่นๆ',
}
const CLAIM_STATUS_CLS: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved:    'bg-green-100 text-green-700',
}
const CLAIM_STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ', in_progress: 'กำลังดำเนินการ', resolved: 'เสร็จแล้ว',
}

const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย', female: 'หญิง', unspecified: 'ไม่ระบุ',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const customer       = useCustomerStore(s => s.customers.find(c => c.customer_id === id))
  const allPurchases   = useCustomerStore(s => s.purchases)
  const updateCustomer = useCustomerStore(s => s.updateCustomer)
  const deleteCustomer = useCustomerStore(s => s.deleteCustomer)
  const addPurchase    = useCustomerStore(s => s.addPurchase)
  const updatePurchase = useCustomerStore(s => s.updatePurchase)
  const deletePurchase = useCustomerStore(s => s.deletePurchase)

  const [editOpen,        setEditOpen]        = useState(false)
  const [purchaseOpen,    setPurchaseOpen]    = useState(false)
  const [editingRecord,   setEditingRecord]   = useState<PurchaseRecord | null>(null)
  const [confirmDel,      setConfirmDel]      = useState(false)
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null)
  const [claimRecord,     setClaimRecord]     = useState<PurchaseRecord | null>(null)
  const [claims,          setClaims]          = useState<Claim[]>([])
  const [payingClaim,     setPayingClaim]     = useState<Claim | null>(null)

  useEscapeKey(useCallback(() => setEditOpen(false),        []), editOpen)
  useEscapeKey(useCallback(() => setPurchaseOpen(false),    []), purchaseOpen)
  useEscapeKey(useCallback(() => setEditingRecord(null),    []), editingRecord !== null)
  useEscapeKey(useCallback(() => setConfirmDel(false),      []), confirmDel)
  useEscapeKey(useCallback(() => setPaymentRecordId(null),  []), paymentRecordId !== null)
  useEscapeKey(useCallback(() => setClaimRecord(null),      []), claimRecord !== null)
  useEscapeKey(useCallback(() => setPayingClaim(null),      []), payingClaim !== null)

  useEffect(() => {
    api.claims.list().then(r => {
      setClaims(r.data.filter((c: Claim) => c.customer_id === id))
    }).catch(() => {})
  }, [id])

  const purchases = useMemo(() =>
    allPurchases
      .filter(p => p.customer_id === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [allPurchases, id])

  const latestRx = useMemo(() => purchases.find(p => p.lens.enabled) ?? null, [purchases])

  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">ไม่พบข้อมูลลูกค้า</p>
        <button type="button" onClick={() => navigate('/customers')}
          className="mt-4 text-sm text-slate-700 underline">
          กลับหน้ารายชื่อ
        </button>
      </div>
    )
  }

  const paymentRecord = purchases.find(p => p.id === paymentRecordId) ?? null

  function handleUpdate(data: CustomerFormData) {
    updateCustomer(customer!.customer_id, data)
    setEditOpen(false)
  }

  function handleDelete() {
    deleteCustomer(customer!.customer_id)
    navigate('/customers')
  }

  async function handleAddPurchase(
    record: Omit<PurchaseRecord, 'id' | 'created_at'>,
    initialPayment?: InitialPayment,
    options?: { stockOverrideConfirmed?: boolean },
  ) {
    await addPurchase(record, initialPayment, options?.stockOverrideConfirmed)
    setPurchaseOpen(false)
  }

  async function handleUpdatePurchase(
    record: Omit<PurchaseRecord, 'id' | 'created_at'>,
    _initialPayment?: InitialPayment,
    options?: { stockOverrideConfirmed?: boolean },
  ) {
    if (!editingRecord) return
    await updatePurchase(editingRecord.id, record, options?.stockOverrideConfirmed)
    setEditingRecord(null)
  }

  function handleDeletePurchase(record: PurchaseRecord) {
    deletePurchase(record.id, customer!.customer_id)
  }

  function handlePrintReceipt(record: PurchaseRecord) {
    printReceipt(record, customer)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Breadcrumb */}
      <button type="button" onClick={() => navigate('/customers')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft size={15} />
        รายชื่อลูกค้า
      </button>

      {/* Profile card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {customer.first_name[0]}
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">
                {customer.first_name} {customer.last_name}
              </h1>
              <p className="text-slate-400 text-sm font-mono"># {customer.customer_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Edit2 size={13} /> แก้ไข
            </button>
            <button type="button" onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 size={13} /> ลบ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100">
          {[
            { label: 'อายุ',         value: `${calcAge(customer.birthday)} ปี` },
            { label: 'เพศ',          value: GENDER_LABEL[customer.gender] ?? '-' },
            { label: 'วันเกิด',      value: formatDate(customer.birthday) },
            { label: 'ซื้อทั้งหมด', value: `${purchases.length} ครั้ง` },
          ].map(item => (
            <div key={item.label} className="px-5 py-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="font-semibold text-slate-900 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-2.5">
          {customer.phone_no && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Phone size={14} className="text-slate-400 shrink-0" />
              {customer.phone_no}
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Mail size={14} className="text-slate-400 shrink-0" />
              {customer.email}
            </div>
          )}
          {customer.address && (
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              {customer.address}
            </div>
          )}
          {customer.note && (
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
              {customer.note}
            </div>
          )}
        </div>
      </div>

      {/* Latest RX panel */}
      {latestRx && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Eye size={14} className="text-violet-500" />
            <span className="text-sm font-semibold text-slate-800">ค่าสายตาล่าสุด</span>
            <span className="text-xs text-slate-400 ml-1">{latestRx.date}</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: 'ค่าที่วัดได้', rx: latestRx.lens, dim: false },
              ...(latestRx.order_rx ? [{ label: 'ค่าที่สั่งเลนส์', rx: { right: latestRx.order_rx.right, left: latestRx.order_rx.left, enabled: true }, dim: false }] : []),
              ...(latestRx.prev_rx  ? [{ label: 'ค่าเก่า (ก่อนหน้า)', rx: { right: latestRx.prev_rx.right, left: latestRx.prev_rx.left, enabled: true }, dim: true }] : []),
            ].map(({ label, rx, dim }) => (
              <div key={label}>
                <p className={`text-xs font-medium mb-1.5 ${dim ? 'text-slate-400' : 'text-slate-600'}`}>{label}</p>
                <div className="overflow-x-auto">
                  <table className={`text-xs w-full ${dim ? 'opacity-60' : ''}`}>
                    <thead>
                      <tr>
                        <th className="w-8 pb-1 text-left text-slate-400">Eye</th>
                        {['SPH','CYL','AXS','ADD','PD'].map(f => (
                          <th key={f} className="pb-1 text-slate-400 font-medium text-center px-2 min-w-[46px]">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['right','left'] as const).map(eye => (
                        <tr key={eye}>
                          <td className={`pr-2 font-bold pb-0.5 ${dim ? 'text-slate-400' : 'text-slate-700'}`}>{eye === 'right' ? 'R' : 'L'}</td>
                          {(['sph','cyl','axs','add','pd'] as const).map(k => (
                            <td key={k} className="px-2 pb-0.5 text-center text-slate-600">
                              {(rx as any)[eye]?.[k] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase history */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">ประวัติการซื้อ</h2>
          <button type="button"
            onClick={() => setPurchaseOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <PlusCircle size={14} />
            บันทึกการซื้อ
          </button>
        </div>

        {purchases.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
            ยังไม่มีประวัติการซื้อ
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map(p => (
              <PurchaseCard
                key={p.id}
                record={p}
                onEdit={rec => setEditingRecord(rec)}
                onPayment={rec => setPaymentRecordId(rec.id)}
                onDelete={handleDeletePurchase}
                onPrint={handlePrintReceipt}
                onClaim={rec => setClaimRecord(rec)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Claims history */}
      {claims.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={15} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">ประวัติการเคลม / ประกัน</h2>
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{claims.length}</span>
          </div>
          <div className="space-y-2">
            {claims.map(c => {
              const unpaid = c.fee > 0 && c.payment_status !== 'paid'
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {CLAIM_TYPE_LABEL[c.claim_type] ?? (c.claim_type || '—')}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CLAIM_STATUS_CLS[c.status]}`}>
                        {CLAIM_STATUS_LABEL[c.status]}
                      </span>
                      {c.fee > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          c.payment_status === 'paid' ? 'bg-green-100 text-green-700'
                          : c.payment_status === 'partial' ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                        }`}>
                          {c.payment_status === 'paid' ? 'ชำระแล้ว'
                           : c.payment_status === 'partial' ? `ชำระแล้ว ฿${c.paid_amount.toLocaleString()}`
                           : `ค้าง ฿${c.fee.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{c.description}</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-0.5">{c.created_at.slice(0, 10)}</p>
                  </div>
                  {unpaid && (
                    <button type="button"
                      onClick={() => setPayingClaim(c)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
                      <CreditCard size={12} /> ชำระ
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Edit customer modal */}
      {editOpen && (
        <CustomerForm
          initial={customer}
          onSubmit={handleUpdate}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* New purchase modal */}
      {purchaseOpen && (
        <PurchaseForm
          customerId={customer.customer_id}
          onSubmit={handleAddPurchase}
          onClose={() => setPurchaseOpen(false)}
        />
      )}

      {/* Edit purchase modal */}
      {editingRecord && (
        <PurchaseForm
          customerId={customer.customer_id}
          initial={editingRecord}
          onSubmit={handleUpdatePurchase}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {/* Payment modal */}
      {paymentRecord && (
        <PaymentModal record={paymentRecord} onClose={() => setPaymentRecordId(null)} />
      )}

      {/* Claim modal */}
      {claimRecord && (
        <ClaimFormModal
          initialPurchase={claimRecord}
          onSaved={() => {
            setClaimRecord(null)
            api.claims.list().then(r => setClaims(r.data.filter((c: Claim) => c.customer_id === id))).catch(() => {})
          }}
          onClose={() => setClaimRecord(null)}
        />
      )}

      {/* Claim payment modal */}
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

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600">
              ลบข้อมูลลูกค้า <span className="font-medium">{customer.first_name} {customer.last_name}</span>{' '}
              และประวัติการซื้อทั้งหมด? ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDel(false)}
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
