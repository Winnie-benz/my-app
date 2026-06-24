import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Square, Package, Pencil, CreditCard, Trash2, Printer, History, ShieldAlert } from 'lucide-react'
import type { PurchaseRecord } from '../../types/customer'
import { formatDate, formatDateTime } from '../../utils/customerUtils'
import ConfirmDialog from '../ConfirmDialog'

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'ค้างชำระ', partial: 'มัดจำ', paid: 'ชำระแล้ว',
}
const PAYMENT_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid:    'bg-green-100 text-green-700',
}

const LENS_TYPE_LABEL: Record<string, string> = {
  single_vision: 'Single Vision',
  bi_focal: 'Bi-Focal',
  pal: 'PAL',
  specialty: 'เฉพาะทาง',
  other: 'อื่นๆ',
}
const LENS_KIND_LABEL: Record<string, string> = {
  stock_order: 'Stock (Order)',
  stock_store: 'Stock (หน้าร้าน)',
  rx: 'RX',
}
const COATING_LABEL: Record<string, string> = {
  hmc: 'HMC', blue_block: 'Blue Block',
  photochromic: 'Photochromic', anti_fog: 'Anti Fog', drive: 'Drive',
}

const RX_FIELDS = ['SPH','CYL','AXS','PRISM','ADD','VA','PD','FH'] as const
const RX_KEYS   = ['sph','cyl','axs','prism','add','va','pd','fh'] as const

type Props = {
  record: PurchaseRecord
  onEdit?: (record: PurchaseRecord) => void
  onPayment?: (record: PurchaseRecord) => void
  onDelete?: (record: PurchaseRecord) => void
  onPrint?: (record: PurchaseRecord) => void
  onClaim?: (record: PurchaseRecord) => void
}

export default function PurchaseCard({ record, onEdit, onPayment, onDelete, onPrint, onClaim }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const items = [
    record.lens.enabled  && 'เลนส์',
    record.frame.enabled && 'กรอบ',
    record.other.enabled && 'สินค้าอื่นๆ',
  ].filter(Boolean).join(' · ')

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-slate-900 font-medium text-sm">{formatDate(record.date)}</div>
          <div className="text-slate-500 text-xs hidden sm:block">{items || '-'}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_STATUS_CLASS[record.payment_status ?? 'pending']}`}>
            {PAYMENT_STATUS_LABEL[record.payment_status ?? 'pending']}
          </span>
          {(record.cost_lens === null || record.cost_frame === null || record.cost_other === null) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              รอต้นทุน
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="font-semibold text-slate-900 text-sm">
            ฿{record.total.toLocaleString()}
          </div>
          {onPrint && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onPrint(record) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
            >
              <Printer size={12} />
              ใบเสร็จ
            </button>
          )}
          {onPayment && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onPayment(record) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
            >
              <CreditCard size={12} />
              ชำระเงิน
            </button>
          )}
          {onClaim && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClaim(record) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
            >
              <ShieldAlert size={12} />
              เคลม
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit(record) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
            >
              <Pencil size={12} />
              แก้ไข
            </button>
          )}
	          {onDelete && (
	            <button
	              type="button"
	              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
	              ยกเลิก
	            </button>
	          )}
	          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
	        </div>
	      </button>

      {/* Detail panel */}
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-5 bg-slate-50/50">

          {/* Previous RX */}
          {record.prev_rx && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <History size={13} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-500">ค่าสายตาเก่า (ก่อนวัดครั้งนี้)</span>
                {record.prev_rx?.sv_eye && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                    {record.prev_rx.sv_eye === 'far' ? 'Far' : 'Near'}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border border-slate-100 rounded-lg overflow-hidden opacity-70">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-slate-400">Eye</th>
                      {RX_FIELDS.map(f => (
                        <th key={f} className="px-2 py-1.5 text-slate-400 font-medium">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {(['right','left'] as const).map(eye => (
                      <tr key={eye}>
                        <td className="px-3 py-1.5 font-semibold text-slate-500">{eye === 'right' ? 'R' : 'L'}</td>
                        {RX_KEYS.map(k => (
                          <td key={k} className="px-2 py-1.5 text-center text-slate-500">
                            {record.prev_rx![eye][k] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Lens */}
          {record.lens.enabled && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Eye size={14} className="text-violet-500" />
                <span className="text-sm font-medium text-slate-800">เลนส์</span>
                <span className="text-xs text-slate-400">
                  {LENS_TYPE_LABEL[record.lens.lens_type]}
                  {record.lens.brand && <span>{' · '}{record.lens.brand}</span>}
                  {record.lens.lens_type === 'single_vision' && record.lens.sv_eye && (
                    <span className="ml-1 text-violet-600 font-medium">
                      ({record.lens.sv_eye === 'far' ? 'Far' : 'Near'})
                    </span>
                  )}
                  {' · '}{LENS_KIND_LABEL[record.lens.lens_kind]} · {record.lens.index}
                </span>
              </div>

              {/* Measured Rx grid */}
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ค่าที่วัดได้</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500">Eye</th>
                      {RX_FIELDS.map(f => (
                        <th key={f} className="px-3 py-2 text-slate-500 font-medium">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {(['right','left'] as const).map(eye => (
                      <tr key={eye}>
                        <td className="px-3 py-2 font-semibold text-slate-700">{eye === 'right' ? 'R' : 'L'}</td>
                        {RX_KEYS.map(k => (
                          <td key={k} className="px-3 py-2 text-center text-slate-600">
                            {record.lens[eye][k] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ordered Rx grid */}
              {record.order_rx && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ค่าที่สั่งเลนส์</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border border-blue-100 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-500">Eye</th>
                          {RX_FIELDS.map(f => (
                            <th key={f} className="px-3 py-2 text-slate-500 font-medium">{f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {(['right','left'] as const).map(eye => (
                          <tr key={eye}>
                            <td className="px-3 py-2 font-semibold text-slate-700">{eye === 'right' ? 'R' : 'L'}</td>
                            {RX_KEYS.map(k => (
                              <td key={k} className="px-3 py-2 text-center text-slate-600">
                                {record.order_rx![eye][k] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {record.lens.coatings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {record.lens.coatings.map(c => (
                    <span key={c} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {COATING_LABEL[c]}
                    </span>
                  ))}
                </div>
              )}
              {record.lens.notes && (
                <p className="mt-1 text-xs text-slate-500">{record.lens.notes}</p>
              )}
            </section>
          )}

          {/* Frame */}
          {record.frame.enabled && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <Square size={14} className="text-sky-500" />
                <span className="text-sm font-medium text-slate-800">กรอบ</span>
                <span className="text-xs text-slate-400">
                  {{
                store: 'กรอบร้าน',
                customer: 'ลูกค้านำมาเอง',
                pre_order: 'Pre-order',
              }[record.frame.source] ?? record.frame.source}
                </span>
              </div>
              {record.frame.source === 'store' && record.frame.barcode && (
                <p className="text-xs text-slate-500 ml-6">Barcode: {record.frame.barcode}</p>
              )}
              {record.frame.source === 'customer' && record.frame.model && (
                <p className="text-xs text-slate-500 ml-6">รุ่น: {record.frame.model}</p>
              )}
            </section>
          )}

          {/* Other */}
          {record.other.enabled && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <Package size={14} className="text-amber-500" />
                <span className="text-sm font-medium text-slate-800">สินค้าอื่นๆ</span>
                {record.other.source === 'pre_order' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Pre-order</span>
                )}
              </div>
              {(!record.other.source || record.other.source === 'store') && record.other.barcode && (
                <p className="text-xs text-slate-500 ml-6">Barcode: {record.other.barcode}</p>
              )}
            </section>
          )}

          {/* Pricing summary */}
          <section className="border-t border-slate-200 pt-4">
            <div className="space-y-1.5 text-sm">
              {record.lens.enabled && (
                <div className="flex justify-between text-slate-600">
                  <span>เลนส์ {record.price_lens.percent > 0 && <span className="text-xs text-green-600">-{record.price_lens.percent}%</span>}</span>
                  <span>฿{record.price_lens.discounted.toLocaleString()}</span>
                </div>
              )}
              {record.frame.enabled && (
                <div className="flex justify-between text-slate-600">
                  <span>กรอบ {record.price_frame.percent > 0 && <span className="text-xs text-green-600">-{record.price_frame.percent}%</span>}</span>
                  <span>฿{record.price_frame.discounted.toLocaleString()}</span>
                </div>
              )}
              {record.other.enabled && (
                <div className="flex justify-between text-slate-600">
                  <span>สินค้าอื่นๆ {record.price_other.percent > 0 && <span className="text-xs text-green-600">-{record.price_other.percent}%</span>}</span>
                  <span>฿{record.price_other.discounted.toLocaleString()}</span>
                </div>
              )}
              {record.special_discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>ส่วนลดพิเศษ</span>
                  <span>-฿{record.special_discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>รวมทั้งหมด</span>
                <span>฿{record.total.toLocaleString()}</span>
              </div>
              {(record.paid_amount > 0 || record.payment_status !== 'pending') && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>ชำระแล้ว</span>
                    <span>฿{record.paid_amount.toLocaleString()}</span>
                  </div>
                  {record.payment_status !== 'paid' && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>ค้างชำระ</span>
                      <span>฿{Math.max(0, record.total - record.paid_amount).toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Pickup */}
          {record.pickup_date && (
            <div className="text-xs text-slate-500">
              วันนัดรับสินค้า: {formatDateTime(record.pickup_date, record.pickup_time)}
            </div>
          )}
        </div>
	      )}
      <ConfirmDialog
        open={confirmDelete}
        title="ยืนยันการยกเลิกรายการ"
        message="ยกเลิกรายการซื้อนี้ใช่หรือไม่? ระบบจะคืน stock และซ่อนรายการนี้จากงานประจำ"
        detail={`${formatDate(record.date)} · ฿${record.total.toLocaleString()}`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDelete?.(record)
          setConfirmDelete(false)
        }}
      />
	    </div>
	  )
	}
