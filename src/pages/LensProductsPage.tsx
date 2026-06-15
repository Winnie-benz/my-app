import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PackageSearch, Plus, Pencil, Trash2, ChevronDown, ClipboardList } from 'lucide-react'
import { api } from '../services/api'
import type { LensProduct, LensVariant, CheckStatus } from '../types/product'
import { useAuthStore } from '../store/useAuthStore'
import { useEscapeKey } from '../hooks/useEscapeKey'

// ── Range helpers ─────────────────────────────────────────────────────────────

function makeRange(maxVal: number, minVal: number, step: number): string[] {
  const vals: string[] = []
  let v = maxVal
  while (v >= minVal - 0.001) {
    vals.push(v.toFixed(2))
    v = Math.round((v - step) * 1000) / 1000
  }
  return vals
}

function variantKey(sph: string, cyl: string) { return `${sph}|${cyl}` }

// ── MatrixCell ────────────────────────────────────────────────────────────────

interface MatrixCellProps {
  variant: LensVariant | undefined
  onSave: (qty: number) => Promise<void>
}

function MatrixCell({ variant, onSave }: MatrixCellProps) {
  const qty = variant?.stock_qty ?? 0
  const [editing, setEditing]   = useState(false)
  const [val, setVal]           = useState('')
  const [saving, setSaving]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setVal(qty.toString())
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commit() {
    const newQty = parseInt(val, 10)
    setEditing(false)
    if (isNaN(newQty) || newQty === qty) return
    setSaving(true)
    await onSave(Math.max(0, newQty))
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        aria-label="จำนวนสต็อก"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full h-9 text-center text-xs font-mono border-2 border-slate-900 rounded-md focus:outline-none bg-white"
      />
    )
  }

  const cls = saving
    ? 'bg-slate-100 text-slate-400'
    : qty === 0
      ? 'text-slate-200 hover:bg-slate-100 hover:text-slate-400'
      : qty <= 2
        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 font-semibold'
        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 font-semibold'

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={saving}
      className={`w-full h-9 text-xs font-mono rounded-md transition-colors ${cls}`}
    >
      {saving ? '…' : qty === 0 ? '—' : qty}
    </button>
  )
}

// ── ProductFormModal ──────────────────────────────────────────────────────────

interface ProductFormModalProps {
  initial: LensProduct | null
  onSaved: (p: LensProduct) => void
  onClose: () => void
}

const EMPTY_PRODUCT = {
  brand: '', series: '', lens_type: '', lens_index: '', coating: '', note: '',
  default_cost: 0, sell_price: 0,
  sph_min: -6.0, sph_max: 0.0, cyl_min: -2.0, cyl_max: 0.0, sph_step: 0.25, cyl_step: 0.25,
}

function ProductFormModal({ initial, onSaved, onClose }: ProductFormModalProps) {
  const [form, setForm]     = useState(initial ? {
    brand: initial.brand, series: initial.series, lens_type: initial.lens_type,
    lens_index: initial.lens_index, coating: initial.coating, note: initial.note,
    default_cost: initial.default_cost ?? 0, sell_price: initial.sell_price ?? 0,
    sph_min: initial.sph_min, sph_max: initial.sph_max,
    cyl_min: initial.cyl_min, cyl_max: initial.cyl_max,
    sph_step: initial.sph_step, cyl_step: initial.cyl_step,
  } : { ...EMPTY_PRODUCT })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand.trim()) { setError('กรุณากรอกยี่ห้อ'); return }
    setSaving(true); setError('')
    try {
      const body = {
        ...form,
        default_cost: Number(form.default_cost),
        sell_price:   Number(form.sell_price),
        sph_min: Number(form.sph_min), sph_max: Number(form.sph_max),
        cyl_min: Number(form.cyl_min), cyl_max: Number(form.cyl_max),
        sph_step: Number(form.sph_step), cyl_step: Number(form.cyl_step),
      }
      const res = initial ? await api.lensProducts.update(initial.id, body) : await api.lensProducts.create(body)
      onSaved(res.data)
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด')
    } finally { setSaving(false) }
  }

  const textFields: { key: keyof typeof EMPTY_PRODUCT; label: string }[] = [
    { key: 'brand',      label: 'ยี่ห้อ *'   },
    { key: 'series',     label: 'รุ่น/Series' },
    { key: 'lens_type',  label: 'ประเภทเลนส์' },
    { key: 'lens_index', label: 'Index'       },
    { key: 'coating',    label: 'Coating'     },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-900 mb-5">
          {initial ? 'แก้ไขสินค้าเลนส์' : 'เพิ่มสินค้าเลนส์'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {textFields.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
              <input type="text" value={String(form[f.key])} onChange={e => set(f.key, e.target.value)}
                aria-label={f.label}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-500 mb-1">หมายเหตุ</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2}
              aria-label="หมายเหตุ"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">ต้นทุนเริ่มต้น/แผ่น (฿)</label>
              <input type="number" min={0} step="0.01" value={Number(form.default_cost)}
                onChange={e => set('default_cost', parseFloat(e.target.value) || 0)}
                aria-label="ต้นทุนเริ่มต้นต่อแผ่น"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ราคาขาย/แผ่น (฿)</label>
              <input type="number" min={0} step="0.01" value={Number(form.sell_price)}
                onChange={e => set('sell_price', parseFloat(e.target.value) || 0)}
                aria-label="ราคาขายต่อแผ่น"
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>

          {/* Range config */}
          <div className="border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 mb-2">SPH / CYL Range</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'sph_max',  label: 'SPH จาก' },
                { key: 'sph_min',  label: 'SPH ถึง'  },
                { key: 'sph_step', label: 'SPH Step' },
                { key: 'cyl_max',  label: 'CYL จาก' },
                { key: 'cyl_min',  label: 'CYL ถึง'  },
                { key: 'cyl_step', label: 'CYL Step' },
              ] as { key: keyof typeof EMPTY_PRODUCT; label: string }[]).map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] text-slate-400 mb-1">{f.label}</label>
                  <input type="number" step="0.25" value={Number(form[f.key])} onChange={e => set(f.key, parseFloat(e.target.value))}
                    aria-label={f.label}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white" />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── StockInModal — stock in with avg cost tracking + direct cost correction ───

interface StockInModalProps {
  sph: string
  cyl: string
  productId: number
  variant?: LensVariant        // undefined = create mode (new cell)
  defaultCost?: number         // pre-fill cost for create mode
  onSaved: (updated: LensVariant) => void
  onClose: () => void
}

function StockInModal({ sph, cyl, productId, variant, defaultCost, onSaved, onClose }: StockInModalProps) {
  const isNew = !variant
  const [tab, setTab]               = useState<'stock-in' | 'stock-out' | 'direct'>('stock-in')
  const [qty, setQty]               = useState('1')
  const [cost, setCost]             = useState(String(isNew ? (defaultCost ?? 0) : 0))
  const [outQty, setOutQty]         = useState('1')
  const [directCost, setDirectCost] = useState(String(variant?.cost ?? 0))
  const [saving, setSaving]         = useState(false)

  const currentStock = variant?.stock_qty ?? 0
  const currentCost  = variant?.cost ?? 0
  const qtyNum       = Math.max(0, parseInt(qty, 10) || 0)
  const costNum      = parseFloat(cost) || 0
  const outQtyNum    = Math.max(0, parseInt(outQty, 10) || 0)
  const newStock     = currentStock + qtyNum
  const newAvgCost   = newStock > 0 ? (currentStock * currentCost + qtyNum * costNum) / newStock : costNum
  const afterOut     = Math.max(0, currentStock - outQtyNum)

  async function handleStockIn(e: React.FormEvent) {
    e.preventDefault()
    if (qtyNum <= 0) return
    setSaving(true)
    try {
      let res: { data: LensVariant }
      if (isNew) {
        res = await api.lensProducts.cell(productId, { sph, cyl, stock_qty: qtyNum, cost: costNum })
      } else {
        res = await api.lensProducts.stockIn(productId, variant!.id, qtyNum, costNum)
      }
      onSaved(res.data)
      onClose()
    } catch { /* empty */ } finally { setSaving(false) }
  }

  async function handleStockOut(e: React.FormEvent) {
    e.preventDefault()
    if (!variant || outQtyNum <= 0) return
    setSaving(true)
    try {
      const res = await api.lensProducts.stockOut(productId, variant.id, outQtyNum)
      onSaved(res.data)
      onClose()
    } catch { /* empty */ } finally { setSaving(false) }
  }

  async function handleDirectCost(e: React.FormEvent) {
    e.preventDefault()
    if (!variant) return
    setSaving(true)
    try {
      const res = await api.lensProducts.cell(productId, { sph, cyl, stock_qty: variant.stock_qty, cost: parseFloat(directCost) || 0 })
      onSaved(res.data)
      onClose()
    } catch { /* empty */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            {isNew ? 'เพิ่มสต็อก — ' : ''}SPH {sph} / CYL {cyl}
          </h3>
          {!isNew && (
            <p className="text-xs text-slate-400 mt-0.5">
              คงเหลือ {currentStock} แผ่น · ต้นทุนเฉลี่ย ฿{currentCost.toFixed(2)}
            </p>
          )}
        </div>

        {/* Existing variant: show tabs. New variant: only stock-in form */}
        {!isNew && (
          <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
            <button type="button" onClick={() => setTab('stock-in')}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${tab === 'stock-in' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              รับเข้า
            </button>
            <button type="button" onClick={() => setTab('stock-out')}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${tab === 'stock-out' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              นำออก
            </button>
            <button type="button" onClick={() => setTab('direct')}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${tab === 'direct' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              แก้ต้นทุน
            </button>
          </div>
        )}

        {(isNew || tab === 'stock-in') && (
          <form onSubmit={handleStockIn} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">จำนวน (แผ่น)</label>
                <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
                  autoFocus aria-label="จำนวน"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ต้นทุน/แผ่น (฿)</label>
                <input type="number" min={0} step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                  aria-label="ต้นทุนต่อแผ่น"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
            </div>
            {qtyNum > 0 && !isNew && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>สต็อกใหม่</span>
                  <span className="font-semibold text-slate-700">{newStock} แผ่น</span>
                </div>
                <div className="flex justify-between">
                  <span>ต้นทุนเฉลี่ยใหม่</span>
                  <span className="font-semibold text-slate-700">฿{newAvgCost.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving || qtyNum <= 0}
                className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                {saving ? '...' : isNew ? 'เพิ่มสต็อก' : 'รับเข้า'}
              </button>
            </div>
          </form>
        )}

        {!isNew && tab === 'stock-out' && (
          <form onSubmit={handleStockOut} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">จำนวนที่นำออก (แผ่น)</label>
              <input type="number" min={1} max={currentStock} value={outQty}
                onChange={e => setOutQty(e.target.value)}
                autoFocus aria-label="จำนวนนำออก"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            {outQtyNum > 0 && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>คงเหลือหลังนำออก</span>
                  <span className={`font-semibold ${afterOut === 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {afterOut} แผ่น
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving || outQtyNum <= 0 || outQtyNum > currentStock}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-red-600 transition-colors">
                {saving ? '...' : 'นำออก'}
              </button>
            </div>
          </form>
        )}

        {!isNew && tab === 'direct' && (
          <form onSubmit={handleDirectCost} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">ต้นทุนเฉลี่ย (฿)</label>
              <input type="number" min={0} step="0.01" value={directCost}
                onChange={e => setDirectCost(e.target.value)}
                autoFocus aria-label="ต้นทุนโดยตรง"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                {saving ? '...' : 'บันทึก'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── LensStockCheckModal ───────────────────────────────────────────────────────

interface LensStockCheckModalProps {
  product: LensProduct
  variants: LensVariant[]
  onClose: () => void
}

interface CountEntry {
  variantId: number
  sph: string
  cyl: string
  sku: string
  expected: number
  counted: number
}

function LensStockCheckModal({ product, variants, onClose }: LensStockCheckModalProps) {
  const username = useAuthStore(s => s.user?.user ?? '')
  const [entries, setEntries] = useState<CountEntry[]>(() =>
    variants.map(v => ({
      variantId: v.id,
      sph: v.sph,
      cyl: v.cyl,
      sku: v.sku,
      expected: v.stock_qty,
      counted:  v.stock_qty,
    }))
  )
  const [saving, setSaving] = useState(false)

  function setCount(idx: number, val: string) {
    const counted = Math.max(0, parseInt(val, 10) || 0)
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, counted } : e))
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const items = entries.map(e => {
        const diff = e.counted - e.expected
        const status: CheckStatus = diff === 0 ? 'ok' : diff < 0 ? 'missing' : 'over'
        return {
          product_id:   e.variantId,
          barcode:      '',
          sku:          e.sku,
          product_name: `${product.brand} ${product.series} SPH ${e.sph} CYL ${e.cyl}`.trim(),
          expected_qty: e.expected,
          counted_qty:  e.counted,
          difference:   diff,
          status,
        }
      })
      await api.inventory.submitSession({ created_by: username, session_type: 'lens', items })
      onClose()
    } catch { /* empty */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] flex flex-col">
        <h3 className="font-semibold text-slate-900 mb-0.5">
          ตรวจนับสต็อก — {product.brand} {product.series}
        </h3>
        <p className="text-xs text-slate-400 mb-4">กรอกจำนวนที่นับได้จริงในแต่ละช่อง</p>

        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8 flex-1">ยังไม่มี variant</p>
        ) : (
          <>
            <div className="flex items-center text-xs text-slate-400 mb-2 gap-3 pr-1">
              <span className="w-28 shrink-0">SPH / CYL</span>
              <span className="flex-1">SKU</span>
              <span className="w-12 text-right">คาดว่า</span>
              <span className="w-16 text-center">นับได้</span>
              <span className="w-10 text-right">ผลต่าง</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
              {entries.map((e, idx) => {
                const diff = e.counted - e.expected
                return (
                  <div key={e.variantId} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-slate-600 w-28 shrink-0">
                      {e.sph} / {e.cyl}
                    </span>
                    <span className="text-xs text-slate-400 flex-1 truncate font-mono">{e.sku || '—'}</span>
                    <span className="text-xs text-slate-500 w-12 text-right tabular-nums">{e.expected}</span>
                    <input
                      type="number"
                      min={0}
                      value={e.counted}
                      onChange={ev => setCount(idx, ev.target.value)}
                      aria-label={`นับจำนวน ${e.sph}/${e.cyl}`}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <span className={`text-xs font-semibold w-10 text-right tabular-nums ${
                      diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
            ยกเลิก
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || entries.length === 0}
            className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึกผล'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LensProductsPage() {
  const [products, setProducts]           = useState<LensProduct[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState<number | null>(null)
  const [variants, setVariants]           = useState<LensVariant[]>([])
  const [loadingV, setLoadingV]           = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct]   = useState<LensProduct | null>(null)
  const [confirmDeleteP, setConfirmDeleteP]   = useState<LensProduct | null>(null)
  const [stockInCell, setStockInCell]     = useState<{ sph: string; cyl: string } | null>(null)
  const [stockCheckOpen, setStockCheckOpen] = useState(false)

  useEscapeKey(useCallback(() => { setShowProductForm(false); setEditingProduct(null) }, []), showProductForm)
  useEscapeKey(useCallback(() => setConfirmDeleteP(null), []),  confirmDeleteP !== null)
  useEscapeKey(useCallback(() => setStockInCell(null),   []),   stockInCell !== null)
  useEscapeKey(useCallback(() => setStockCheckOpen(false), []), stockCheckOpen)

  useEffect(() => { loadProducts() }, [])

  useEffect(() => {
    if (selectedId === null) { setVariants([]); return }
    setLoadingV(true)
    api.lensProducts.listVariants(selectedId)
      .then(r => setVariants(r.data))
      .catch(() => {})
      .finally(() => setLoadingV(false))
  }, [selectedId])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await api.lensProducts.list()
      setProducts(res.data)
      if (res.data.length > 0 && selectedId === null) setSelectedId(res.data[0].id)
    } catch { /* empty */ } finally { setLoading(false) }
  }

  const selected = products.find(p => p.id === selectedId) ?? null

  const sphRange = useMemo(() =>
    selected ? makeRange(selected.sph_max, selected.sph_min, selected.sph_step) : [],
  [selected])

  const cylRange = useMemo(() =>
    selected ? makeRange(selected.cyl_max, selected.cyl_min, selected.cyl_step) : [],
  [selected])

  const variantMap = useMemo(() => {
    const m: Record<string, LensVariant> = {}
    for (const v of variants) m[variantKey(v.sph, v.cyl)] = v
    return m
  }, [variants])

  async function handleCellSave(sph: string, cyl: string, qty: number) {
    if (!selectedId) return
    try {
      const res = await api.lensProducts.cell(selectedId, { sph, cyl, stock_qty: qty })
      const updated = res.data
      setVariants(prev => {
        const key = variantKey(sph, cyl)
        const exists = prev.find(v => variantKey(v.sph, v.cyl) === key)
        if (updated === null) return prev.filter(v => variantKey(v.sph, v.cyl) !== key)
        return exists ? prev.map(v => variantKey(v.sph, v.cyl) === key ? updated : v) : [...prev, updated]
      })
      setProducts(prev => prev.map(p => p.id === selectedId ? { ...p, total_stock: p.total_stock + (qty - (variantMap[variantKey(sph, cyl)]?.stock_qty ?? 0)) } : p))
    } catch { /* empty */ }
  }

  function handleStockInSaved(updated: LensVariant) {
    const old = variants.find(v => v.id === updated.id)
    const diff = updated.stock_qty - (old?.stock_qty ?? 0)
    setVariants(prev => {
      const exists = prev.some(v => v.id === updated.id)
      return exists ? prev.map(v => v.id === updated.id ? updated : v) : [...prev, updated]
    })
    if (diff !== 0) {
      setProducts(prev => prev.map(p => p.id === selectedId ? { ...p, total_stock: p.total_stock + diff } : p))
    }
  }

  function handleProductSaved(p: LensProduct) {
    setShowProductForm(false)
    if (editingProduct) {
      setProducts(prev => prev.map(x => x.id === p.id ? p : x))
    } else {
      setProducts(prev => [...prev, p])
      setSelectedId(p.id)
    }
    setEditingProduct(null)
  }

  async function handleDeleteProduct() {
    if (!confirmDeleteP) return
    try {
      await api.lensProducts.remove(confirmDeleteP.id)
      setProducts(prev => prev.filter(x => x.id !== confirmDeleteP.id))
      if (selectedId === confirmDeleteP.id) setSelectedId(null)
    } catch { /* empty */ } finally { setConfirmDeleteP(null) }
  }

  const totalStock = selected ? variants.reduce((s, v) => s + v.stock_qty, 0) : 0
  const stockInVariant = stockInCell ? variantMap[variantKey(stockInCell.sph, stockInCell.cyl)] : undefined

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PackageSearch size={20} className="text-slate-700" />
          <h1 className="text-xl font-semibold text-slate-900">สินค้าเลนส์</h1>
        </div>
        <button type="button" onClick={() => { setEditingProduct(null); setShowProductForm(true) }}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
          <Plus size={15} />
          เพิ่มสินค้า
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-16">กำลังโหลด...</p>
      ) : products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <PackageSearch size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">ยังไม่มีสินค้าเลนส์</p>
          <button type="button" onClick={() => setShowProductForm(true)}
            className="mt-3 text-sm text-slate-700 underline">เพิ่มสินค้าแรก</button>
        </div>
      ) : (
        <div className="flex gap-6">

          {/* Product list sidebar */}
          <div className="w-56 shrink-0 space-y-1.5">
            {products.map(p => {
              const active = p.id === selectedId
              const total = p.total_stock
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold truncate">{p.brand}</p>
                  <p className={`text-xs truncate mt-0.5 ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                    {p.series || p.lens_index || '—'}
                  </p>
                  <p className={`text-xs mt-1 font-mono font-bold ${
                    active ? 'text-slate-200' : total === 0 ? 'text-red-400' : 'text-emerald-600'
                  }`}>
                    {total} pcs
                  </p>
                </button>
              )
            })}
          </div>

          {/* Matrix panel */}
          {selected && (
            <div className="flex-1 min-w-0">
              {/* Product info bar */}
              <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">
                    {selected.brand} {selected.series}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[selected.lens_type, selected.lens_index && `Index ${selected.lens_index}`, selected.coating].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-center shrink-0">
                  <div>
                    <p className="text-xs text-slate-400">คงเหลือ</p>
                    <p className={`text-lg font-bold tabular-nums ${totalStock === 0 ? 'text-red-500' : 'text-slate-900'}`}>
                      {totalStock}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">SPH</p>
                    <p className="text-xs text-slate-600 font-mono">{selected.sph_max.toFixed(2)} → {selected.sph_min.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">CYL</p>
                    <p className="text-xs text-slate-600 font-mono">{selected.cyl_max.toFixed(2)} → {selected.cyl_min.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setStockCheckOpen(true)}
                      title="ตรวจนับสต็อก"
                      className="flex items-center gap-1.5 text-xs border border-slate-200 hover:border-slate-400 text-slate-600 px-2.5 py-1.5 rounded-xl transition-colors">
                      <ClipboardList size={13} />
                      ตรวจนับ
                    </button>
                    <button type="button" onClick={() => { setEditingProduct(selected); setShowProductForm(true) }}
                      title="แก้ไขสินค้า"
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteP(selected)}
                      title="ลบสินค้า"
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
                <span>คลิกที่ช่องเพื่อแก้ไขจำนวน</span>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-mono">3+</span>
                  <span className="text-slate-400">พอ</span>
                  <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded font-mono">1-2</span>
                  <span className="text-slate-400">ใกล้หมด</span>
                  <span className="text-slate-300 px-2 py-0.5 font-mono">—</span>
                  <span className="text-slate-400">ไม่มี</span>
                </div>
              </div>

              {/* Matrix table */}
              {loadingV ? (
                <p className="text-sm text-slate-400 text-center py-12">กำลังโหลด...</p>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-auto">
                  <table className="border-collapse min-w-max">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2 text-xs font-semibold text-slate-400 border-b border-r border-slate-200 whitespace-nowrap">
                          SPH \ CYL
                        </th>
                        {cylRange.map(cyl => (
                          <th key={cyl} className="px-1 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100 text-center min-w-[60px]">
                            {cyl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sphRange.map((sph, si) => (
                        <tr key={sph} className={si % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="sticky left-0 bg-inherit z-10 px-3 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200 whitespace-nowrap font-mono">
                            {sph}
                          </td>
                          {cylRange.map(cyl => {
                            const v = variantMap[variantKey(sph, cyl)]
                            return (
                              <td key={cyl} className="px-1 py-1">
                                {v ? (
                                  <div className="flex flex-col gap-0.5">
                                    <MatrixCell
                                      variant={v}
                                      onSave={qty => handleCellSave(sph, cyl, qty)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setStockInCell({ sph, cyl })}
                                      className="text-[9px] text-slate-400 hover:text-slate-600 text-center leading-none"
                                      title="รับเข้า / แก้ไขต้นทุน"
                                    >
                                      {v.cost > 0 ? `฿${v.cost.toFixed(0)}` : 'cost'}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setStockInCell({ sph, cyl })}
                                    title="เพิ่มสต็อก"
                                    className="w-full h-9 text-xs font-mono rounded-md text-slate-200 hover:bg-slate-100 hover:text-slate-400 transition-colors"
                                  >
                                    —
                                  </button>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SKU note */}
              {variants.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <ChevronDown size={12} className="text-slate-400" />
                  <p className="text-xs text-slate-400">
                    ตัวอย่าง SKU: <span className="font-mono">{variants[0]?.sku}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Product form modal */}
      {showProductForm && (
        <ProductFormModal
          initial={editingProduct}
          onSaved={handleProductSaved}
          onClose={() => { setShowProductForm(false); setEditingProduct(null) }}
        />
      )}

      {/* Delete product confirmation */}
      {confirmDeleteP && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600">
              ลบ <span className="font-semibold">{confirmDeleteP.brand} {confirmDeleteP.series}</span> และ variant ทั้งหมด? ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDeleteP(null)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={handleDeleteProduct}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600 transition-colors">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock in / cost modal — opens for both new cells and existing variants */}
      {stockInCell && selectedId && (
        <StockInModal
          sph={stockInCell.sph}
          cyl={stockInCell.cyl}
          productId={selectedId}
          variant={stockInVariant}
          defaultCost={selected?.default_cost ?? 0}
          onSaved={handleStockInSaved}
          onClose={() => setStockInCell(null)}
        />
      )}

      {/* Lens stock check modal */}
      {stockCheckOpen && selected && (
        <LensStockCheckModal
          product={selected}
          variants={variants}
          onClose={() => setStockCheckOpen(false)}
        />
      )}
    </div>
  )
}
