import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2 } from 'lucide-react'
import type { Claim, ClaimPayment } from '../../types/customer'
import { notify } from '../../utils/notify'
import { api } from '../../services/api'
import { formatDate } from '../../utils/customerUtils'

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด', transfer: 'โอนธนาคาร', card: 'บัตรเครดิต/เดบิต', qr: 'QR Code',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'ค้างชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว',
}
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid:    'bg-green-100 text-green-700',
}

const paymentSchema = z.object({
  amount:  z.number({ invalid_type_error: 'กรุณากรอกจำนวน' }).min(1, 'จำนวนต้องมากกว่า 0'),
  method:  z.enum(['cash', 'transfer', 'card', 'qr'] as const),
  note:    z.string().default(''),
  paid_at: z.string().min(1, 'กรุณาเลือกวันที่'),
})
type PaymentFormValues = z.infer<typeof paymentSchema>

type Props = {
  claim: Claim
  onClose: () => void
  onUpdated: (updatedClaim: Claim) => void
}

export default function ClaimPaymentModal({ claim, onClose, onUpdated }: Props) {
  const [payments,     setPayments]     = useState<ClaimPayment[]>([])
  const [submitting,   setSubmitting]   = useState(false)
  const [currentClaim, setCurrentClaim] = useState<Claim>(claim)
  const [submitError,  setSubmitError]  = useState('')

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: 'cash', note: '', paid_at: today },
  })

  async function loadPayments() {
    try {
      const res = await api.claimPayments.list(currentClaim.id)
      setPayments(res.data)
    } catch { /* empty */ }
  }

  useEffect(() => { loadPayments() }, [currentClaim.id])

  const remaining = currentClaim.fee - currentClaim.paid_amount

  async function onAddPayment(values: PaymentFormValues) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await api.claimPayments.create(currentClaim.id, values)
      const updated = res.claim as Claim
      setCurrentClaim(updated)
      onUpdated(updated)
      await loadPayments()
      reset({ amount: 0, method: 'cash', note: '', paid_at: today })
    } catch (err: any) {
      const message = err?.message || 'บันทึกการชำระเงินค่าบริการเคลมไม่สำเร็จ'
      setSubmitError(message)
      notify('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onDeletePayment(paymentId: string) {
    try {
      setSubmitError('')
      const res = await api.claimPayments.remove(currentClaim.id, paymentId)
      const updated = res.claim as Claim
      setCurrentClaim(updated)
      onUpdated(updated)
      await loadPayments()
    } catch (err: any) {
      const message = err?.message || 'ลบการชำระเงินค่าบริการเคลมไม่สำเร็จ'
      setSubmitError(message)
      notify('error', message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="font-semibold text-slate-900">ชำระค่าบริการเคลม</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-400">เคลมวันที่ {formatDate(currentClaim.created_at.slice(0, 10))}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[currentClaim.payment_status]}`}>
                {STATUS_LABEL[currentClaim.payment_status]}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {submitError && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
              {submitError}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">ค่าบริการ</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">฿{currentClaim.fee.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-green-600">ชำระแล้ว</p>
              <p className="font-semibold text-green-700 text-sm mt-0.5">฿{currentClaim.paid_amount.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl px-4 py-3 text-center ${remaining > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-xs ${remaining > 0 ? 'text-red-500' : 'text-green-600'}`}>ค้างชำระ</p>
              <p className={`font-semibold text-sm mt-0.5 ${remaining > 0 ? 'text-red-700' : 'text-green-700'}`}>
                ฿{Math.max(0, remaining).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ประวัติการชำระ</p>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">฿{p.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {PAYMENT_METHOD_LABEL[p.method]} · {formatDate(p.paid_at)}
                        {p.note && ` · ${p.note}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeletePayment(p.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add payment form */}
          {currentClaim.payment_status !== 'paid' ? (
            <form onSubmit={handleSubmit(onAddPayment)}
              className="border border-slate-200 rounded-xl px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">เพิ่มการชำระเงิน</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">จำนวนเงิน (฿)</label>
                  <input type="number" min={0}
                    {...register('amount', { valueAsNumber: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="0" />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">วันที่ชำระ</label>
                  <input type="date" {...register('paid_at')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  {errors.paid_at && <p className="text-red-500 text-xs mt-1">{errors.paid_at.message}</p>}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">วิธีชำระ</p>
                <div className="flex flex-wrap gap-3">
                  {(['cash', 'transfer', 'card', 'qr'] as const).map(m => (
                    <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input {...register('method')} type="radio" value={m} className="accent-slate-900" />
                      {PAYMENT_METHOD_LABEL[m]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
                <input {...register('note')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="ระบุหมายเหตุ (ถ้ามี)" />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                {submitting ? 'กำลังบันทึก...' : 'บันทึกการชำระ'}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 text-sm text-green-600 font-medium bg-green-50 rounded-xl">
              ชำระครบแล้ว
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
