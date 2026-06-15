import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Search, ShieldAlert, Package, X, Plus } from 'lucide-react'
import { api } from '../../services/api'
import { useCustomerStore } from '../../store/useCustomerStore'
import { useProductStore } from '../../store/useProductStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { PurchaseRecord } from '../../types/customer'
import type { Product } from '../../types/product'

const CLAIM_TYPES = [
  { key: 'broken_frame',   label: 'กรอบแตก/หัก' },
  { key: 'scratched_lens', label: 'เลนส์ขูดขีด' },
  { key: 'rx_change',      label: 'ค่าสายตาเปลี่ยน' },
  { key: 'adjustment',     label: 'ปรับกรอบ' },
  { key: 'other',          label: 'อื่นๆ' },
]

const RX_KEYS = ['sph','cyl','axs','add','pd'] as const

function PurchaseSummary({ record }: { record: PurchaseRecord }) {
  const items = [
    record.lens.enabled  && 'เลนส์',
    record.frame.enabled && 'กรอบ',
    record.other.enabled && 'สินค้าอื่นๆ',
  ].filter(Boolean).join(' · ')

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">วันที่ซื้อ: <span className="font-medium text-slate-700">{record.date}</span></span>
        <span className="font-semibold text-slate-900">฿{record.total.toLocaleString()}</span>
      </div>
      {items && <p className="text-xs text-slate-500">{items}</p>}
      {record.lens.enabled && (
        <div className="overflow-x-auto">
          <table className="text-[10px] w-full border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left text-slate-400">Eye</th>
                {(['SPH','CYL','AXS','ADD','PD'] as const).map(f => (
                  <th key={f} className="px-2 py-1 text-slate-400 font-medium">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {(['right','left'] as const).map(eye => (
                <tr key={eye}>
                  <td className="px-2 py-1 font-bold text-slate-600">{eye === 'right' ? 'R' : 'L'}</td>
                  {RX_KEYS.map(k => (
                    <td key={k} className="px-2 py-1 text-center text-slate-500">
                      {record.lens[eye][k] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface StockItemEntry {
  product: Product
  qty: number
}

interface StockPickerProps {
  items: StockItemEntry[]
  onChange: (items: StockItemEntry[]) => void
}

function StockItemPicker({ items, onChange }: StockPickerProps) {
  const products = useProductStore(s => s.products)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6)
  }, [products, query])

  function addProduct(p: Product) {
    const existing = items.findIndex(i => i.product.id === p.id)
    if (existing >= 0) {
      onChange(items.map((i, idx) => idx === existing ? { ...i, qty: i.qty + 1 } : i))
    } else {
      onChange([...items, { product: p, qty: 1 }])
    }
    setQuery('')
  }

  function updateQty(idx: number, val: string) {
    const qty = Math.max(1, parseInt(val, 10) || 1)
    onChange(items.map((i, j) => j === idx ? { ...i, qty } : i))
  }

  function remove(idx: number) {
    onChange(items.filter((_, j) => j !== idx))
  }

  const totalCost = items.reduce((s, i) => s + i.product.avg_cost * i.qty, 0)

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ค้นหาสินค้า (ชื่อ / barcode / SKU)..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map(p => (
              <button key={p.id} type="button" onClick={() => addProduct(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.barcode}{p.sku ? ` · ${p.sku}` : ''}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs text-slate-500">คงเหลือ {p.stock_current}</p>
                  <p className="text-xs text-slate-400">ต้นทุน ฿{p.avg_cost.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={item.product.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <Package size={13} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{item.product.name}</p>
                <p className="text-[10px] text-slate-400">ต้นทุน ฿{item.product.avg_cost.toLocaleString()}/ชิ้น</p>
              </div>
              <input
                type="number" min={1}
                value={item.qty}
                onChange={e => updateQty(idx, e.target.value)}
                aria-label={`จำนวน ${item.product.name}`}
                className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <p className="text-xs font-semibold text-slate-700 w-20 text-right tabular-nums shrink-0">
                ฿{(item.product.avg_cost * item.qty).toLocaleString()}
              </p>
              <button type="button" onClick={() => remove(idx)} aria-label={`ลบ ${item.product.name}`}
                className="text-slate-300 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex justify-between items-center px-3 pt-1 text-xs">
            <span className="text-slate-500">รวมต้นทุนวัสดุเคลม</span>
            <span className="font-semibold text-slate-900">฿{totalCost.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  initialPurchase?: PurchaseRecord
  onSaved: () => void
  onClose: () => void
}

export default function ClaimFormModal({ initialPurchase, onSaved, onClose }: Props) {
  useEscapeKey(useCallback(() => onClose(), [onClose]))
  const customers  = useCustomerStore(s => s.customers)
  const purchases  = useCustomerStore(s => s.purchases)

  // selection state (only used when no initialPurchase)
  const [custSearch,   setCustSearch]   = useState('')
  const [selectedCust, setSelectedCust] = useState<string | null>(null)
  const [selectedPurch, setSelectedPurch] = useState<PurchaseRecord | null>(initialPurchase ?? null)

  // claim form state
  const [claimType,   setClaimType]   = useState('')
  const [description, setDescription] = useState('')
  const [fee,         setFee]         = useState('0')
  const [pickupDate,  setPickupDate]  = useState('')
  const [stockItems,  setStockItems]  = useState<StockItemEntry[]>([])
  const [showStock,   setShowStock]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const filteredCustomers = customers.filter(c => {
    const q = custSearch.toLowerCase()
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.phone_no.includes(q)
  }).slice(0, 8)

  const custPurchases = selectedCust
    ? purchases.filter(p => p.customer_id === selectedCust)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPurch) return
    if (!claimType) { setError('กรุณาเลือกประเภทการเคลม'); return }
    setSaving(true); setError('')
    try {
      await api.claims.create({
        purchase_id: selectedPurch.id,
        customer_id: selectedPurch.customer_id,
        claim_type: claimType,
        description,
        fee: parseFloat(fee) || 0,
        pickup_date: pickupDate,
        items: stockItems.map(i => ({ product_id: i.product.id, qty: i.qty, cost: i.product.avg_cost })),
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-slate-700" />
          <h3 className="font-semibold text-slate-900">เพิ่มรายการเคลม</h3>
        </div>

        {/* Step 1: customer search (only when no initialPurchase) */}
        {!initialPurchase && !selectedPurch && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">เลือกลูกค้า</p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            {custSearch && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่พบลูกค้า</p>
                ) : filteredCustomers.map(c => (
                  <button
                    key={c.customer_id}
                    type="button"
                    onClick={() => setSelectedCust(c.customer_id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-slate-400">{c.phone_no}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: purchase selection */}
        {!initialPurchase && selectedCust && !selectedPurch && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">เลือกรายการซื้อ</p>
              <button type="button" onClick={() => setSelectedCust(null)}
                className="text-xs text-slate-400 hover:text-slate-700">เปลี่ยนลูกค้า</button>
            </div>
            {custPurchases.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">ไม่มีรายการซื้อ</p>
            ) : custPurchases.map(p => {
              const items = [
                p.lens.enabled  && 'เลนส์',
                p.frame.enabled && 'กรอบ',
                p.other.enabled && 'สินค้าอื่นๆ',
              ].filter(Boolean).join(' · ')
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPurch(p)}
                  className="w-full text-left border border-slate-200 hover:border-slate-900 px-4 py-3 rounded-xl transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-900">{p.date}</span>
                    <span className="text-sm font-semibold text-slate-900">฿{p.total.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{items || '—'}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 3: claim form with purchase summary */}
        {selectedPurch && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-medium">รายการที่เคลม</p>
              <PurchaseSummary record={selectedPurch} />
              {!initialPurchase && (
                <button type="button" onClick={() => setSelectedPurch(null)}
                  className="text-xs text-slate-400 hover:text-slate-700">เปลี่ยนรายการ</button>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2">ประเภทการเคลม *</p>
              <div className="flex flex-wrap gap-2">
                {CLAIM_TYPES.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setClaimType(t.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      claimType === t.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">รายละเอียด</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="อธิบายปัญหาหรือสิ่งที่ต้องทำ..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">ค่าใช้จ่าย (฿) — 0 หากฟรี</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={fee}
                  onChange={e => setFee(e.target.value)}
                  aria-label="ค่าใช้จ่าย"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">วันนัดรับ</label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={e => setPickupDate(e.target.value)}
                  aria-label="วันนัดรับ"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Stock items used for this claim */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowStock(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-500" />
                  <span className="font-medium text-slate-700">สินค้าที่ใช้ซ่อม / เปลี่ยน</span>
                  {stockItems.length > 0 && (
                    <span className="text-xs bg-slate-900 text-white rounded-full px-2 py-0.5">{stockItems.length}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{showStock ? 'ซ่อน' : 'เพิ่ม'}</span>
              </button>
              {showStock && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">ระบบจะหักจาก stock อัตโนมัติเมื่อบันทึก และนำต้นทุนไปรวมในรายงานกำไร</p>
                  <StockItemPicker items={stockItems} onChange={setStockItems} />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving || !claimType}
                className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการเคลม'}
              </button>
            </div>
          </form>
        )}

        {/* Cancel button when no purchase selected yet */}
        {!selectedPurch && (
          <div className="pt-1">
            <button type="button" onClick={onClose}
              className="w-full border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
