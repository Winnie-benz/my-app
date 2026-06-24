import { useMemo, useState, useEffect, useRef } from 'react'
import { useForm, Controller, useWatch, Control, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Eye, Square, Package, History, AlertTriangle, Search } from 'lucide-react'
import type { PurchaseRecord, Coating, LensType, LensKind, LensIndex, PaymentMethod, InitialPayment, StockOverrideWarning } from '../../types/customer'
import { BLANK_EYE } from '../../types/customer'
import { useProductStore } from '../../store/useProductStore'
import { ApiError, api } from '../../services/api'
import type { Product, LensProduct, LensVariant } from '../../types/product'
import { notify } from '../../utils/notify'
import { LENS_INDEXES, lensBrandOptions } from '../../constants/lensBrands'

// ── Schema ────────────────────────────────────────────────────────────────────

const eyeSchema = z.object({
  sph: z.string(), cyl: z.string(), axs: z.string(), prism: z.string(),
  add: z.string(), va: z.string(), pd: z.string(), fh: z.string(),
})

const priceSchema = z.object({
  full:       z.number().min(0),
  discounted: z.number().min(0),
})

const schema = z.object({
  date: z.string().min(1, 'กรุณาเลือกวันที่'),
  prev_rx_enabled: z.boolean().default(false),
  prev_rx_sv_eye:  z.enum(['far', 'near', '']).default(''),
  prev_rx_right:   eyeSchema,
  prev_rx_left:    eyeSchema,
  lens: z.object({
    enabled: z.boolean(),
    product_id: z.number().nullable().optional(),
    product_name: z.string().default(''),
    sku: z.string().default(''),
    brand: z.string().default(''),
    right: eyeSchema, left: eyeSchema,
    lens_type: z.enum(['single_vision','bi_focal','pal','specialty','other']),
    sv_eye: z.enum(['far', 'near', '']).default(''),
    lens_kind: z.enum(['stock_order','stock_store','rx']),
    barcode: z.string(), index: z.enum(['1.50','1.56','1.60','1.67','1.74']),
    coatings: z.array(z.enum(['hmc','blue_block','photochromic','anti_fog','drive'])),
    notes: z.string(),
  }),
  order_rx_enabled: z.boolean().default(false),
  order_rx_right:   eyeSchema,
  order_rx_left:    eyeSchema,
  lens_variant_id_r: z.number().nullable().optional(),
  lens_variant_id_l: z.number().nullable().optional(),
  frame: z.object({
    enabled: z.boolean(),
    product_id: z.number().nullable().optional(),
    product_name: z.string().default(''),
    sku: z.string().default(''),
    source: z.enum(['store','customer','pre_order']),
    barcode: z.string(),
    model: z.string().default(''),
  }),
  other: z.object({
    enabled: z.boolean(),
    product_id: z.number().nullable().optional(),
    product_name: z.string().default(''),
    sku: z.string().default(''),
    source: z.enum(['store','pre_order']).default('store'),
    barcode: z.string(),
  }),
  price_lens:  priceSchema,
  price_frame: priceSchema,
  price_other: priceSchema,
  special_discount: z.number().min(0),
  pickup_date: z.string(),
  pickup_time: z.string(),
  payment_amount: z.number().min(0).default(0),
  payment_method: z.enum(['cash', 'transfer', 'card', 'qr']).default('cash'),
  payment_note:   z.string().default(''),
  payment_date:   z.string().default(''),
})

type FormValues = z.infer<typeof schema>

// ── Options ───────────────────────────────────────────────────────────────────

const LENS_TYPES: { value: LensType; label: string }[] = [
  { value: 'single_vision', label: 'Single Vision' },
  { value: 'bi_focal',      label: 'Bi-Focal'      },
  { value: 'pal',           label: 'PAL'            },
  { value: 'specialty',     label: 'เฉพาะทาง'       },
  { value: 'other',         label: 'อื่นๆ'           },
]
const LENS_KINDS: { value: LensKind; label: string }[] = [
  { value: 'stock_order', label: 'Stock (Order)'   },
  { value: 'stock_store', label: 'Stock (หน้าร้าน)' },
  { value: 'rx',          label: 'RX'               },
]
const COATINGS: { value: Coating; label: string }[] = [
  { value: 'hmc',          label: 'HMC'          },
  { value: 'blue_block',   label: 'Blue Block'   },
  { value: 'photochromic', label: 'Photochromic' },
  { value: 'anti_fog',     label: 'Anti Fog'     },
  { value: 'drive',        label: 'Drive'        },
]
const RX_FIELDS = ['SPH','CYL','AXS','PRISM','ADD','VA','PD','FH'] as const
const RX_KEYS   = ['sph','cyl','axs','prism','add','va','pd','fh'] as const

function calcPercent(full: number, discounted: number): number {
  return full > 0 ? Math.max(0, Math.round(((full - discounted) / full) * 100)) : 0
}

function safeNumber(value: number | undefined | null): number {
  return Number.isFinite(value) ? Number(value) : 0
}

// ── Sub-components (defined OUTSIDE to preserve identity across re-renders) ───

interface PriceRowProps {
  label: string
  fieldBase: 'price_lens' | 'price_frame' | 'price_other'
  disabled: boolean
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
}

function PriceRow({ label, fieldBase, disabled, control, register }: PriceRowProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const full       = useWatch({ control, name: `${fieldBase}.full`       as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discounted = useWatch({ control, name: `${fieldBase}.discounted` as any }) as number ?? 0
  const percent = calcPercent(full, discounted)

  const cls = (d: boolean) =>
    `w-full border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
      d ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white'
    }`

  return (
    <tr className={disabled ? 'opacity-40' : ''}>
      <td className="py-2 pr-4 text-sm text-slate-600 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2 pr-2">
        <input type="number" min={0} disabled={disabled}
          {...register(`${fieldBase}.full`, { valueAsNumber: true })}
          className={cls(disabled)} placeholder="0" />
      </td>
      <td className="py-2 pr-2">
        <input type="number" min={0} disabled={disabled}
          {...register(`${fieldBase}.discounted`, { valueAsNumber: true })}
          className={cls(disabled)} placeholder="0" />
      </td>
      <td className="py-2 w-20">
        <div className={`flex items-center justify-center border rounded-lg px-2.5 py-2 text-sm ${
          disabled ? 'border-slate-100 bg-slate-100 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700 font-semibold'
        }`}>
          {percent}<span className="text-slate-400 text-xs ml-0.5 font-normal">%</span>
        </div>
      </td>
    </tr>
  )
}

interface TotalDisplayProps {
  control: Control<FormValues>
  lensEnabled: boolean
  frameEnabled: boolean
  otherEnabled: boolean
}

function TotalDisplay({ control, lensEnabled, frameEnabled, otherEnabled }: TotalDisplayProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lDisc   = useWatch({ control, name: 'price_lens.discounted'  as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fDisc   = useWatch({ control, name: 'price_frame.discounted' as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oDisc   = useWatch({ control, name: 'price_other.discounted' as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specDis = useWatch({ control, name: 'special_discount'       as any }) as number ?? 0

  const total = useMemo(() => {
    let sum = 0
    if (lensEnabled)  sum += lDisc
    if (frameEnabled) sum += fDisc
    if (otherEnabled) sum += oDisc
    return Math.max(0, sum - specDis)
  }, [lensEnabled, frameEnabled, otherEnabled, lDisc, fDisc, oDisc, specDis])

  return (
    <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl px-5 py-3">
      <span className="font-medium text-sm">ราคารวมสุดท้าย</span>
      <span className="font-bold text-xl">฿ {total.toLocaleString()}</span>
    </div>
  )
}

interface BarcodeFieldProps {
  itemBase: 'lens' | 'frame' | 'other'
  fieldName: Parameters<UseFormRegister<FormValues>>[0]
  priceBase: 'price_lens' | 'price_frame' | 'price_other'
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  products: Product[]
  disabled?: boolean
}

function ProductSearchField({ itemBase, fieldName, priceBase, control, setValue, products, disabled }: BarcodeFieldProps) {
  const query = (useWatch({ control, name: fieldName as any }) as string) ?? ''
  const selectedProductId = useWatch({ control, name: `${itemBase}.product_id` as any }) as number | null | undefined
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmOutOfStockId, setConfirmOutOfStockId] = useState<number | null>(null)

  const selectedProduct = useMemo(() => {
    if (selectedProductId) {
      const byId = products.find(p => p.id === selectedProductId)
      if (byId) return byId
    }
    const q = query.trim()
    return products.find(p => p.barcode === q || p.sku === q)
  }, [products, query, selectedProductId])

  useEffect(() => {
    const q = query.trim()
    setConfirmOutOfStockId(null)
    if (disabled || !q) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }
    const currentProduct = selectedProductId
      ? products.find(p => p.id === selectedProductId)
      : null
    if (currentProduct && (q === currentProduct.barcode || q === currentProduct.sku)) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(() => {
      api.products.search(q)
        .then(res => {
          if (cancelled) return
          setSuggestions(res.data)
          setOpen(true)
        })
        .catch(() => {
          if (cancelled) return
          setSuggestions([])
          setOpen(false)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, disabled, products, selectedProductId])

  function selectProduct(product: Product) {
    setValue(`${itemBase}.product_id` as any, product.id, { shouldDirty: true, shouldValidate: true })
    setValue(`${itemBase}.product_name` as any, product.name, { shouldDirty: true })
    setValue(`${itemBase}.sku` as any, product.sku ?? '', { shouldDirty: true })
    setValue(fieldName, product.barcode || product.sku || '', { shouldDirty: true, shouldValidate: true })
    setValue(`${priceBase}.full` as any, product.sell_price ?? 0, { shouldDirty: true, shouldValidate: true })
    setValue(`${priceBase}.discounted` as any, product.sell_price ?? 0, { shouldDirty: true, shouldValidate: true })
    setOpen(false)
  }

  function stockText(product: Product) {
    if (product.stock_current <= 0) return { label: 'หมดสต็อก', cls: 'text-red-600 bg-red-50 border-red-100' }
    if (product.stock_current <= (product.reorder_point ?? 1)) return { label: `สต็อกต่ำ ${product.stock_current}`, cls: 'text-amber-700 bg-amber-50 border-amber-100' }
    return { label: `คงเหลือ ${product.stock_current}`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' }
  }

  return (
    <div className="relative z-40">
      <label className="block text-xs font-medium text-slate-600 mb-1">ค้นหาสินค้า</label>
      <Controller
        control={control}
        name={fieldName as any}
        render={({ field }) => (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              {...field}
              disabled={disabled}
              autoComplete="off"
              onFocus={() => {
                if (query.trim()) setOpen(true)
              }}
              onBlur={() => {
                field.onBlur()
                window.setTimeout(() => setOpen(false), 120)
              }}
              onChange={e => {
                field.onChange(e)
                setValue(`${itemBase}.product_id` as any, null, { shouldDirty: true })
                setValue(`${itemBase}.product_name` as any, '', { shouldDirty: true })
                setValue(`${itemBase}.sku` as any, '', { shouldDirty: true })
              }}
              className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                disabled ? 'border-slate-100 bg-slate-100 text-slate-400' : selectedProduct?.stock_current === 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
              }`}
              placeholder="สแกน barcode หรือค้นชื่อ / SKU"
            />
          </div>
        )}
      />

      {open && !disabled && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <p className="px-3 py-3 text-xs text-slate-400">กำลังค้นหา...</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400">ไม่พบสินค้าในสต็อก</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {suggestions.map(product => {
                const stock = stockText(product)
                const isOut = product.stock_current <= 0
                const needsConfirm = isOut && confirmOutOfStockId !== product.id
                return (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      if (needsConfirm) {
                        setConfirmOutOfStockId(product.id)
                        return
                      }
                      selectProduct(product)
                    }}
                    className={`w-full text-left px-3 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors ${
                      isOut ? 'bg-red-50/50 hover:bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isOut ? 'text-red-700' : 'text-slate-900'}`}>
                          {product.name}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          SKU: {product.sku || '-'} · Barcode: {product.barcode || '-'}
                        </p>
                        {needsConfirm && (
                          <p className="text-[11px] text-red-600 mt-1">หมดสต็อก คลิกอีกครั้งเพื่อเลือก</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex border rounded-full px-2 py-0.5 text-[11px] font-medium ${stock.cls}`}>
                          {stock.label}
                        </span>
                        <p className="text-xs font-semibold text-slate-700 mt-1">฿{(product.sell_price ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selectedProduct && (
        <p className={`text-xs mt-1 flex items-center gap-1 flex-wrap ${
          selectedProduct.stock_current <= 0 ? 'text-red-600' : selectedProduct.stock_current <= (selectedProduct.reorder_point ?? 1) ? 'text-amber-700' : 'text-green-600'
        }`}>
          ✓ {selectedProduct.name}
          <span className="text-slate-400">SKU {selectedProduct.sku || '-'} · Barcode {selectedProduct.barcode || '-'}</span>
          <span className="text-slate-400">(คงเหลือ {selectedProduct.stock_current})</span>
          {selectedProduct.sell_price > 0 && (
            <span className="text-slate-500">· ราคาขาย ฿{selectedProduct.sell_price.toLocaleString()}</span>
          )}
        </p>
      )}
    </div>
  )
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด', transfer: 'โอนธนาคาร', card: 'บัตรเครดิต/เดบิต', qr: 'QR Code',
}

interface PaymentSectionProps {
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  lensEnabled: boolean
  frameEnabled: boolean
  otherEnabled: boolean
  paymentAmountError?: string
  paymentDateError?: string
}

function PaymentSection({
  control, register, lensEnabled, frameEnabled, otherEnabled, paymentAmountError, paymentDateError,
}: PaymentSectionProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lDisc   = useWatch({ control, name: 'price_lens.discounted'  as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fDisc   = useWatch({ control, name: 'price_frame.discounted' as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oDisc   = useWatch({ control, name: 'price_other.discounted' as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const specDis = useWatch({ control, name: 'special_discount'       as any }) as number ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payAmt  = useWatch({ control, name: 'payment_amount'         as any }) as number ?? 0

  const total = useMemo(() => {
    let sum = 0
    if (lensEnabled)  sum += lDisc
    if (frameEnabled) sum += fDisc
    if (otherEnabled) sum += oDisc
    return Math.max(0, sum - specDis)
  }, [lensEnabled, frameEnabled, otherEnabled, lDisc, fDisc, oDisc, specDis])

  const remaining = Math.max(0, total - payAmt)

  const cls = (hasError?: boolean) => `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200'
  }`

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-medium text-slate-800 text-sm">การชำระเงินเริ่มต้น</span>
        <span className="text-xs text-slate-400 ml-2">(ไม่บังคับ)</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">จำนวนเงิน (฿)</label>
            <input type="number" min={0}
              {...register('payment_amount', { valueAsNumber: true })}
              className={cls(!!paymentAmountError)} placeholder="0" />
            {paymentAmountError && <p className="text-xs text-red-500 mt-1">{paymentAmountError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">วันที่ชำระ</label>
            <input type="date" {...register('payment_date')} className={cls(!!paymentDateError)} />
            {paymentDateError && <p className="text-xs text-red-500 mt-1">{paymentDateError}</p>}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">วิธีชำระ</p>
          <div className="flex flex-wrap gap-3">
            {(['cash', 'transfer', 'card', 'qr'] as const).map(m => (
              <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input {...register('payment_method')} type="radio" value={m} className="accent-slate-900" />
                {PAYMENT_METHOD_LABEL[m]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
          <input {...register('payment_note')} className={cls()} placeholder="ระบุหมายเหตุ (ถ้ามี)" />
        </div>

        {payAmt > 0 && (
          <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
            <span className="text-slate-500">ค้างชำระ</span>
            <span className={`font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ฿{remaining.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function makePickerRange(maxVal: number, minVal: number, step: number): string[] {
  const vals: string[] = []
  let v = maxVal
  while (v >= minVal - 0.001) {
    vals.push(v.toFixed(2))
    v = Math.round((v - step) * 1000) / 1000
  }
  return vals
}

// ── Default form values from a PurchaseRecord (for edit mode) ─────────────────

function recordToDefaults(r: PurchaseRecord): FormValues {
  return {
    date:            r.date,
    prev_rx_enabled: !!r.prev_rx,
    prev_rx_sv_eye:  r.prev_rx?.sv_eye ?? '',
    prev_rx_right:   r.prev_rx?.right ?? { ...BLANK_EYE },
    prev_rx_left:    r.prev_rx?.left  ?? { ...BLANK_EYE },
    order_rx_enabled: !!r.order_rx,
    order_rx_right:   r.order_rx?.right ?? { ...BLANK_EYE },
    order_rx_left:    r.order_rx?.left  ?? { ...BLANK_EYE },
    lens_variant_id_r: r.lens_variant_id_r ?? null,
    lens_variant_id_l: r.lens_variant_id_l ?? null,
    lens:     { ...r.lens, product_id: r.lens.product_id ?? null, product_name: r.lens.product_name ?? '', sku: r.lens.sku ?? '', brand: r.lens.brand ?? '' },
    frame:    { ...r.frame, product_id: r.frame.product_id ?? null, product_name: r.frame.product_name ?? '', sku: r.frame.sku ?? '', model: r.frame.model ?? '' },
    other:    { ...r.other, product_id: r.other.product_id ?? null, product_name: r.other.product_name ?? '', sku: r.other.sku ?? '', source: r.other.source ?? 'store' },
    price_lens:  { full: r.price_lens.full,  discounted: r.price_lens.discounted  },
    price_frame: { full: r.price_frame.full, discounted: r.price_frame.discounted },
    price_other: { full: r.price_other.full, discounted: r.price_other.discounted },
    special_discount: r.special_discount,
    pickup_date: r.pickup_date,
    pickup_time: r.pickup_time,
    payment_amount: 0,
    payment_method: 'cash',
    payment_note:   '',
    payment_date:   '',
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  customerId: string
  initial?: PurchaseRecord
  onSubmit: (
    record: Omit<PurchaseRecord, 'id' | 'created_at'>,
    initialPayment?: InitialPayment,
    options?: { stockOverrideConfirmed?: boolean },
  ) => Promise<void> | void
  onClose: () => void
}

type PendingSubmission = {
  record: Omit<PurchaseRecord, 'id' | 'created_at'>
  initialPayment?: InitialPayment
}

type ServerFieldErrors = Record<string, string[]>

function isStockWarningError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.payload?.error === 'INSUFFICIENT_STOCK'
}

export default function PurchaseForm({ customerId, initial, onSubmit, onClose }: Props) {
  const products = useProductStore(s => s.products)

  const [lensProducts, setLensProducts]   = useState<LensProduct[]>([])
  const [lensVariants, setLensVariants]   = useState<LensVariant[]>([])
  const [pickerProdId, setPickerProdId]   = useState<number | null>(null)
  const [pickerSphR, setPickerSphR]       = useState('')
  const [pickerCylR, setPickerCylR]       = useState('')
  const [pickerSphL, setPickerSphL]       = useState('')
  const [pickerCylL, setPickerCylL]       = useState('')
  const [stockWarnings, setStockWarnings] = useState<StockOverrideWarning[]>([])
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmission | null>(null)
  const [submitting, setSubmitting]       = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState<ServerFieldErrors>({})
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    api.lensProducts.list().then(r => setLensProducts(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (pickerProdId === null) { setLensVariants([]); return }
    api.lensProducts.listVariants(pickerProdId).then(r => setLensVariants(r.data)).catch(() => {})
  }, [pickerProdId])

  // Restore picker state when editing a purchase that already has lens variants
  useEffect(() => {
    const vidR = initial?.lens_variant_id_r
    const vidL = initial?.lens_variant_id_l
    if (!vidR && !vidL) return
    const ids = [vidR, vidL].filter((v): v is number => typeof v === 'number')
    api.lensProducts.variantLookup(ids).then(res => {
      const first = res.data[0]
      if (!first) return
      setPickerProdId(first.lens_product_id)
      const vR = res.data.find((v: any) => v.id === vidR)
      const vL = res.data.find((v: any) => v.id === vidL)
      if (vR) { setPickerSphR(vR.sph); setPickerCylR(vR.cyl) }
      if (vL) { setPickerSphL(vL.sph); setPickerCylL(vL.cyl) }
    }).catch(() => {})
  }, [])

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? recordToDefaults(initial) : {
      date:            new Date().toISOString().split('T')[0],
      prev_rx_enabled: false,
      prev_rx_sv_eye:  '' as const,
      prev_rx_right:   { ...BLANK_EYE },
      prev_rx_left:    { ...BLANK_EYE },
      order_rx_enabled: false,
      order_rx_right:   { ...BLANK_EYE },
      lens_variant_id_r: null,
      lens_variant_id_l: null,
      order_rx_left:    { ...BLANK_EYE },
      lens: {
        enabled: false, product_id: null, product_name: '', sku: '', brand: '',
        right: { ...BLANK_EYE }, left: { ...BLANK_EYE },
        lens_type: 'single_vision', sv_eye: '' as const, lens_kind: 'rx',
        barcode: '', index: '1.56', coatings: [], notes: '',
      },
      frame: { enabled: false, product_id: null, product_name: '', sku: '', source: 'store', barcode: '', model: '' },
      other: { enabled: false, product_id: null, product_name: '', sku: '', source: 'store', barcode: '' },
      price_lens:  { full: 0, discounted: 0 },
      price_frame: { full: 0, discounted: 0 },
      price_other: { full: 0, discounted: 0 },
      special_discount: 0,
      pickup_date: '', pickup_time: '',
      payment_amount: 0,
      payment_method: 'cash' as const,
      payment_note:   '',
      payment_date:   '',
    },
  })

  // Section toggles (watched at top level — not price fields)
  const prevRxEnabled = useWatch({ control, name: 'prev_rx_enabled' })
  const lensEnabled   = useWatch({ control, name: 'lens.enabled'    })
  const frameEnabled  = useWatch({ control, name: 'frame.enabled'   })
  const otherEnabled  = useWatch({ control, name: 'other.enabled'   })

  const lensType    = useWatch({ control, name: 'lens.lens_type' }) as LensType
  const lensKind    = useWatch({ control, name: 'lens.lens_kind' }) as LensKind
  const lensBrand   = useWatch({ control, name: 'lens.brand'     }) as string
  const frameSource = useWatch({ control, name: 'frame.source'   }) as 'store' | 'customer' | 'pre_order'
  const orderRxEnabled = useWatch({ control, name: 'order_rx_enabled' })
  const otherSource = useWatch({ control, name: 'other.source'   }) as 'store' | 'pre_order'

  // Clear lens variant IDs and picker when user switches away from stock_store
  const lensKindInitRef = useRef(true)
  useEffect(() => {
    if (lensKindInitRef.current) { lensKindInitRef.current = false; return }
    if (lensKind !== 'stock_store') {
      setValue('lens_variant_id_r', null)
      setValue('lens_variant_id_l', null)
      setValue('lens.product_id', null)
      setValue('lens.product_name', '')
      setValue('lens.sku', '')
      setValue('lens.barcode', '')
      setPickerProdId(null)
      setPickerSphR(''); setPickerCylR(''); setPickerSphL(''); setPickerCylL('')
    }
  }, [lensKind, setValue])

  useEffect(() => {
    if (frameSource !== 'store') {
      setValue('frame.product_id', null)
      setValue('frame.product_name', '')
      setValue('frame.sku', '')
      setValue('frame.barcode', '')
    }
  }, [frameSource, setValue])

  useEffect(() => {
    if (otherSource !== 'store') {
      setValue('other.product_id', null)
      setValue('other.product_name', '')
      setValue('other.sku', '')
      setValue('other.barcode', '')
    }
  }, [otherSource, setValue])

  // Lens variant picker — sync R/L variant_ids into form
  const pickerProduct = lensProducts.find(p => p.id === pickerProdId) ?? null

  const pickerSphRange = useMemo(() =>
    pickerProduct ? makePickerRange(pickerProduct.sph_max, pickerProduct.sph_min, pickerProduct.sph_step) : [],
  [pickerProduct])

  const pickerCylRange = useMemo(() =>
    pickerProduct ? makePickerRange(pickerProduct.cyl_max, pickerProduct.cyl_min, pickerProduct.cyl_step) : [],
  [pickerProduct])

  const pickedVariantR = useMemo(() =>
    lensVariants.find(v => v.sph === pickerSphR && v.cyl === pickerCylR) ?? null,
  [lensVariants, pickerSphR, pickerCylR])

  const pickedVariantL = useMemo(() =>
    lensVariants.find(v => v.sph === pickerSphL && v.cyl === pickerCylL) ?? null,
  [lensVariants, pickerSphL, pickerCylL])

  const lensBrandItems = useMemo(() => lensBrandOptions(lensBrand), [lensBrand])

  useEffect(() => {
    setValue('lens_variant_id_r', pickedVariantR?.id ?? null)
  }, [pickedVariantR, setValue])

  useEffect(() => {
    setValue('lens_variant_id_l', pickedVariantL?.id ?? null)
  }, [pickedVariantL, setValue])

  useEffect(() => {
    if (lensKind === 'stock_store' && pickerProduct?.brand && !lensBrand) {
      setValue('lens.brand', pickerProduct.brand)
    }
  }, [lensKind, lensBrand, pickerProduct, setValue])

  const showLensBarcode  = lensKind === 'stock_store' && lensProducts.length === 0
  const showFrameBarcode = frameSource === 'store'
  const showOtherBarcode = otherSource === 'store'

  function serverError(field: string) {
    return serverFieldErrors[field]?.[0] ?? ''
  }

  const issueItems = [
    { label: 'วันที่ซื้อ', message: errors.date?.message || serverError('date') },
    { label: 'ราคาส่วนเลนส์', message: errors.price_lens?.full?.message || errors.price_lens?.discounted?.message || serverError('price_lens') },
    { label: 'ราคาส่วนกรอบ', message: errors.price_frame?.full?.message || errors.price_frame?.discounted?.message || serverError('price_frame') },
    { label: 'ราคาส่วนสินค้าอื่นๆ', message: errors.price_other?.full?.message || errors.price_other?.discounted?.message || serverError('price_other') },
    { label: 'ส่วนลดพิเศษ', message: errors.special_discount?.message || serverError('special_discount') },
    { label: 'วันนัดรับ', message: errors.pickup_date?.message || serverError('pickup_date') },
    { label: 'เวลานัดรับ', message: errors.pickup_time?.message || serverError('pickup_time') },
    { label: 'จำนวนเงินชำระ', message: errors.payment_amount?.message || serverError('payment_amount') },
    { label: 'วันที่ชำระ', message: errors.payment_date?.message || serverError('payment_date') },
  ].filter(item => item.message)

  const submit = async (values: FormValues) => {
    setServerFieldErrors({})
    setSubmitError('')
    const priceLens  = { full: safeNumber(values.price_lens.full),  discounted: safeNumber(values.price_lens.discounted)  }
    const priceFrame = { full: safeNumber(values.price_frame.full), discounted: safeNumber(values.price_frame.discounted) }
    const priceOther = { full: safeNumber(values.price_other.full), discounted: safeNumber(values.price_other.discounted) }
    const specialDiscount = safeNumber(values.special_discount)
    const paymentAmount = safeNumber(values.payment_amount)

    function exactProduct(item: { product_id?: number | null; barcode: string; sku?: string }) {
      if (item.product_id) {
        const byId = products.find(p => p.id === item.product_id)
        if (byId) return byId
      }
      const q = (item.barcode || item.sku || '').trim()
      if (!q) return null
      return products.find(p => p.barcode === q || p.sku === q) ?? null
    }

    function requireInventoryProduct(
      item: { product_id?: number | null; barcode: string; sku?: string },
      label: string,
    ) {
      const product = exactProduct(item)
      if (!product) {
        notify('error', `กรุณาเลือก${label}จากรายการค้นหา`)
        return null
      }
      return product
    }

    const lensInventoryProduct = lensEnabled && values.lens.lens_kind === 'stock_store' && showLensBarcode
      ? requireInventoryProduct(values.lens, 'เลนส์')
      : null
    if (lensEnabled && values.lens.lens_kind === 'stock_store' && showLensBarcode && !lensInventoryProduct) return

    const frameInventoryProduct = frameEnabled && values.frame.source === 'store'
      ? requireInventoryProduct(values.frame, 'กรอบ')
      : null
    if (frameEnabled && values.frame.source === 'store' && !frameInventoryProduct) return

    const otherInventoryProduct = otherEnabled && values.other.source === 'store'
      ? requireInventoryProduct(values.other, 'สินค้าอื่นๆ')
      : null
    if (otherEnabled && values.other.source === 'store' && !otherInventoryProduct) return

    let total = 0
    if (lensEnabled)  total += priceLens.discounted
    if (frameEnabled) total += priceFrame.discounted
    if (otherEnabled) total += priceOther.discounted
    total = Math.max(0, total - specialDiscount)

    const initialPayment: InitialPayment | undefined =
      !initial && paymentAmount > 0
        ? {
            amount:  paymentAmount,
            method:  values.payment_method as PaymentMethod,
            note:    values.payment_note,
            paid_at: values.payment_date || values.date,
          }
        : undefined

    const record: Omit<PurchaseRecord, 'id' | 'created_at'> = {
      customer_id: customerId,
      date: values.date,
      prev_rx: values.prev_rx_enabled
        ? { right: values.prev_rx_right, left: values.prev_rx_left, sv_eye: values.prev_rx_sv_eye }
        : null,
      order_rx: values.order_rx_enabled
        ? { right: values.order_rx_right, left: values.order_rx_left }
        : null,
      lens_variant_id_r: values.lens_variant_id_r ?? null,
      lens_variant_id_l: values.lens_variant_id_l ?? null,
      lens: lensInventoryProduct
        ? { ...values.lens, product_id: lensInventoryProduct.id, product_name: lensInventoryProduct.name, sku: lensInventoryProduct.sku ?? '', barcode: lensInventoryProduct.barcode || lensInventoryProduct.sku || values.lens.barcode }
        : values.lens,
      frame: frameInventoryProduct
        ? { ...values.frame, product_id: frameInventoryProduct.id, product_name: frameInventoryProduct.name, sku: frameInventoryProduct.sku ?? '', barcode: frameInventoryProduct.barcode || frameInventoryProduct.sku || values.frame.barcode }
        : values.frame,
      other: otherInventoryProduct
        ? { ...values.other, product_id: otherInventoryProduct.id, product_name: otherInventoryProduct.name, sku: otherInventoryProduct.sku ?? '', barcode: otherInventoryProduct.barcode || otherInventoryProduct.sku || values.other.barcode }
        : values.other,
      price_lens:  { ...priceLens,  percent: calcPercent(priceLens.full,  priceLens.discounted)  },
      price_frame: { ...priceFrame, percent: calcPercent(priceFrame.full, priceFrame.discounted) },
      price_other: { ...priceOther, percent: calcPercent(priceOther.full, priceOther.discounted) },
      special_discount: specialDiscount,
      total,
      pickup_date: values.pickup_date,
      pickup_time: values.pickup_time,
      payment_status: initial?.payment_status ?? 'pending',
      paid_amount:    initial?.paid_amount    ?? 0,
      order_status:   initial?.order_status   ?? 'waiting',
      cost_lens:      initial?.cost_lens      ?? null,
      cost_frame:     initial?.cost_frame     ?? null,
      cost_other:     initial?.cost_other     ?? null,
      stock_override: initial?.stock_override ?? null,
    }

    setStockWarnings([])
    setPendingSubmit(null)
    setSubmitting(true)
    try {
      await onSubmit(record, initialPayment)
    } catch (error) {
      if (isStockWarningError(error)) {
        setPendingSubmit({ record, initialPayment })
        setStockWarnings(error.payload.warnings ?? [])
      } else if (error instanceof ApiError && error.payload?.error && typeof error.payload.error === 'object') {
        setServerFieldErrors(error.payload.error.fieldErrors ?? {})
        const formError = error.payload.error.formErrors?.[0]
        setSubmitError(formError || 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบรายการซื้ออีกครั้ง')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmStockOverride() {
    if (!pendingSubmit) return
    setSubmitting(true)
    try {
      await onSubmit(pendingSubmit.record, pendingSubmit.initialPayment, { stockOverrideConfirmed: true })
      setStockWarnings([])
      setPendingSubmit(null)
    } catch (error) {
      if (isStockWarningError(error)) {
        setStockWarnings(error.payload.warnings ?? [])
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="font-semibold text-slate-900">
            {initial ? 'แก้ไขรายการซื้อ' : 'บันทึกการซื้อ'}
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิด"
            className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="px-6 py-5 space-y-5">
          {(submitError || issueItems.length > 0) && (
            <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 space-y-1.5">
              {submitError && <p className="text-sm font-medium text-red-700">{submitError}</p>}
              {issueItems.map(item => (
                <p key={item.label} className="text-xs text-red-600">
                  {item.label}: {item.message}
                </p>
              ))}
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">วันที่ซื้อ *</label>
            <input type="date" {...register('date')}
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                errors.date || serverError('date') ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`} />
            {(errors.date?.message || serverError('date')) && (
              <p className="text-red-500 text-xs">{errors.date?.message || serverError('date')}</p>
            )}
          </div>

          {/* ── Previous RX ───────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <Controller control={control} name="prev_rx_enabled"
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange}
                    aria-label="บันทึกค่าสายตาเก่า"
                    className="w-4 h-4 accent-slate-900 cursor-pointer" />
                )} />
              <History size={15} className="text-slate-400" />
              <span className="font-medium text-slate-700 text-sm">ค่าสายตาเก่า</span>
              <span className="text-xs text-slate-400">(ก่อนวัดครั้งนี้)</span>
            </div>
            {prevRxEnabled && (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium">ประเภท</span>
                  {([['far', 'Far (ไกล)'], ['near', 'Near (ใกล้)']] as const).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input {...register('prev_rx_sv_eye')} type="radio" value={v} className="accent-slate-900" />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        <th className="w-8 pb-2 text-left text-slate-400">Eye</th>
                        {RX_FIELDS.map(f => (
                          <th key={f} className="pb-2 text-slate-500 font-medium text-center px-1 min-w-[58px]">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['right','left'] as const).map(eye => (
                        <tr key={eye}>
                          <td className="pr-2 font-bold text-slate-400 pb-1">{eye === 'right' ? 'R' : 'L'}</td>
                          {RX_KEYS.map(k => (
                            <td key={k} className="px-1 pb-1">
                              <input
                                {...register(`prev_rx_${eye}.${k}` as Parameters<typeof register>[0])}
                                className="w-full border border-slate-200 rounded px-1.5 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50"
                                placeholder="-" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Lens ──────────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <Controller control={control} name="lens.enabled"
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange}
                    aria-label="เปิดใช้งานส่วนเลนส์"
                    className="w-4 h-4 accent-slate-900 cursor-pointer" />
                )} />
              <Eye size={15} className="text-violet-500" />
              <span className="font-medium text-slate-800 text-sm">เลนส์</span>
            </div>

            {lensEnabled && (
              <div className="px-4 py-4 space-y-4">
                {/* Measured Rx grid */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">ค่าที่วัดได้</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="w-8 pb-2 text-left text-slate-400">Eye</th>
                          {RX_FIELDS.map(f => (
                            <th key={f} className="pb-2 text-slate-500 font-medium text-center px-1 min-w-[58px]">{f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(['right','left'] as const).map(eye => (
                          <tr key={eye}>
                            <td className="pr-2 font-bold text-slate-700 pb-1">{eye === 'right' ? 'R' : 'L'}</td>
                            {RX_KEYS.map(k => (
                              <td key={k} className="px-1 pb-1">
                                <input
                                  {...register(`lens.${eye}.${k}` as Parameters<typeof register>[0])}
                                  className="w-full border border-slate-200 rounded px-1.5 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-900"
                                  placeholder="-" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ordered Rx — hidden when stock_store (SPH/CYL already captured by picker) */}
                <div className={`border border-dashed border-slate-200 rounded-lg overflow-hidden ${lensKind === 'stock_store' ? 'hidden' : ''}`}>
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-50/70">
                    <Controller control={control} name="order_rx_enabled"
                      render={({ field }) => (
                        <input type="checkbox" checked={field.value} onChange={field.onChange}
                          aria-label="บันทึกค่าที่สั่งเลนส์"
                          className="w-4 h-4 accent-slate-900 cursor-pointer" />
                      )} />
                    <span className="text-xs font-medium text-slate-600">ค่าที่สั่งเลนส์ (ถ้าต่างจากค่าวัด)</span>
                  </div>
                  {orderRxEnabled && (
                    <div className="px-3 pb-3 pt-2 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr>
                            <th className="w-8 pb-2 text-left text-slate-400">Eye</th>
                            {RX_FIELDS.map(f => (
                              <th key={f} className="pb-2 text-slate-500 font-medium text-center px-1 min-w-[58px]">{f}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(['right','left'] as const).map(eye => (
                            <tr key={eye}>
                              <td className="pr-2 font-bold text-slate-700 pb-1">{eye === 'right' ? 'R' : 'L'}</td>
                              {RX_KEYS.map(k => (
                                <td key={k} className="px-1 pb-1">
                                  <input
                                    {...register(`order_rx_${eye}.${k}` as Parameters<typeof register>[0])}
                                    className="w-full border border-slate-200 rounded px-1.5 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    placeholder="-" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Lens type */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">ประเภทเลนส์</p>
                  <div className="flex flex-wrap gap-3">
                    {LENS_TYPES.map(t => (
                      <label key={t.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input {...register('lens.lens_type')} type="radio" value={t.value} className="accent-slate-900" />
                        {t.label}
                      </label>
                    ))}
                  </div>
                  {lensType === 'single_vision' && (
                    <div className="flex items-center gap-4 mt-2 pl-1">
                      {([['far', 'Far (ไกล)'], ['near', 'Near (ใกล้)']] as const).map(([v, label]) => (
                        <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-600">
                          <input {...register('lens.sv_eye')} type="radio" value={v} className="accent-slate-900" />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lens kind */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">ชนิด</p>
                  <div className="flex flex-wrap gap-3">
                    {LENS_KINDS.map(k => (
                      <label key={k.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input {...register('lens.lens_kind')} type="radio" value={k.value} className="accent-slate-900" />
                        {k.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ยี่ห้อเลนส์</label>
                  <select
                    {...register('lens.brand')}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="">— เลือกยี่ห้อเลนส์ —</option>
                    {lensBrandItems.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {lensKind === 'stock_store' && pickerProduct
                      ? 'ดึงอัตโนมัติจากสินค้าเลนส์ที่เลือก แต่ยังแก้ได้หากต้องการ'
                      : 'ใช้สำหรับสรุปรายงานยี่ห้อเลนส์ขายดี'}
                  </p>
                </div>

                {/* Lens variant picker — stock_store only, split R/L */}
                {lensKind === 'stock_store' && lensProducts.length > 0 && (
                  <div className="border border-dashed border-violet-200 rounded-xl p-3 bg-violet-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-violet-700">สต็อกเลนส์ (ตัดอัตโนมัติ)</p>
                      {(pickedVariantR || pickedVariantL) && (
                        <p className="text-[10px] text-violet-500">
                          ตัดสต็อก {(pickedVariantR ? 1 : 0) + (pickedVariantL ? 1 : 0)} ชิ้น เมื่อบันทึก
                        </p>
                      )}
                    </div>

                    {/* Product selector */}
                    <select
                      aria-label="เลือกสินค้าเลนส์"
                      value={pickerProdId ?? ''}
                      onChange={e => {
                        const prodId = e.target.value ? Number(e.target.value) : null
                        setPickerProdId(prodId)
                        setPickerSphR(''); setPickerCylR(''); setPickerSphL(''); setPickerCylL('')
                        if (prodId) {
                          const lp = lensProducts.find(p => p.id === prodId)
                          if (lp && lp.sell_price > 0) {
                            setValue('price_lens.full' as any, lp.sell_price, { shouldDirty: true, shouldValidate: true })
                            setValue('price_lens.discounted' as any, lp.sell_price, { shouldDirty: true, shouldValidate: true })
                          }
                          if (lp?.brand) setValue('lens.brand', lp.brand, { shouldDirty: true })
                        }
                      }}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    >
                      <option value="">— เลือกสินค้าเลนส์ —</option>
                      {lensProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.brand} {p.series} {p.lens_index && `(${p.lens_index})`}</option>
                      ))}
                    </select>

                    {/* R / L pickers */}
                    {pickerProdId && (
                      <div className="space-y-2">
                        {([
                          { eye: 'R', label: 'ขวา (R)', sph: pickerSphR, setSph: setPickerSphR, cyl: pickerCylR, setCyl: setPickerCylR, variant: pickedVariantR },
                          { eye: 'L', label: 'ซ้าย (L)', sph: pickerSphL, setSph: setPickerSphL, cyl: pickerCylL, setCyl: setPickerCylL, variant: pickedVariantL },
                        ] as const).map(({ eye, label, sph, setSph, cyl, setCyl, variant }) => (
                          <div key={eye} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 w-14 shrink-0">{label}</span>
                            <select
                              aria-label={`SPH ${eye}`}
                              value={sph}
                              onChange={e => { setSph(e.target.value); setCyl('') }}
                              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                            >
                              <option value="">SPH</option>
                              {pickerSphRange.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <select
                              aria-label={`CYL ${eye}`}
                              value={cyl}
                              onChange={e => setCyl(e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                            >
                              <option value="">CYL</option>
                              {pickerCylRange.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            {sph && cyl && (
                              variant
                                ? <span className={`text-xs font-medium ${variant.stock_qty <= 0 ? 'text-red-500' : variant.stock_qty <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {variant.stock_qty} อัน
                                  </span>
                                : <span className="text-xs text-slate-400">ไม่พบ</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Barcode + Index */}
                <div className="grid grid-cols-2 gap-4">
                  {showLensBarcode
                    ? (
                      <ProductSearchField
                        itemBase="lens"
                        fieldName="lens.barcode"
                        priceBase="price_lens"
                        control={control}
                        setValue={setValue}
                        products={products}
                      />
                    )
                    : <div />
                  }
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Index</p>
                    <div className="flex flex-wrap gap-3">
                      {LENS_INDEXES.map(idx => (
                        <label key={idx} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input {...register('lens.index')} type="radio" value={idx} className="accent-slate-900" />
                          {idx}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Coating */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Coating</p>
                  <div className="flex flex-wrap gap-3">
                    {COATINGS.map(c => (
                      <label key={c.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Controller control={control} name="lens.coatings"
                          render={({ field }) => (
                            <input type="checkbox" className="accent-slate-900"
                              checked={field.value.includes(c.value)}
                              onChange={e => {
                                field.onChange(e.target.checked
                                  ? [...field.value, c.value]
                                  : field.value.filter((v: string) => v !== c.value))
                              }} />
                          )} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">รายละเอียดเพิ่มเติม</label>
                  <textarea {...register('lens.notes')} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                    placeholder="รายละเอียดเลนส์..." />
                </div>
              </div>
            )}
          </div>

          {/* ── Frame ─────────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <Controller control={control} name="frame.enabled"
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange}
                    aria-label="เปิดใช้งานส่วนกรอบ"
                    className="w-4 h-4 accent-slate-900 cursor-pointer" />
                )} />
              <Square size={15} className="text-sky-500" />
              <span className="font-medium text-slate-800 text-sm">กรอบ</span>
            </div>
            {frameEnabled && (
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">แหล่งที่มา</p>
                  <div className="flex gap-4">
                    {[
                    { value: 'store',     label: 'กรอบร้าน'       },
                    { value: 'customer',  label: 'ลูกค้านำมาเอง'   },
                    { value: 'pre_order', label: 'Pre-order'       },
                  ].map(s => (
                      <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input {...register('frame.source')} type="radio" value={s.value} className="accent-slate-900" />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                {frameSource === 'store' && (
                  <ProductSearchField
                    itemBase="frame"
                    fieldName="frame.barcode"
                    priceBase="price_frame"
                    control={control}
                    setValue={setValue}
                    products={products}
                  />
                )}
                {frameSource === 'customer' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">รุ่น / ยี่ห้อกรอบ</label>
                    <input
                      {...register('frame.model')}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      placeholder="เช่น Ray-Ban RB3025" />
                  </div>
                )}
                {frameSource === 'pre_order' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Pre-order — จะบันทึกต้นทุนและรับสินค้าในภายหลัง
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Other ─────────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <Controller control={control} name="other.enabled"
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange}
                    aria-label="เปิดใช้งานส่วนสินค้าอื่นๆ"
                    className="w-4 h-4 accent-slate-900 cursor-pointer" />
                )} />
              <Package size={15} className="text-amber-500" />
              <span className="font-medium text-slate-800 text-sm">สินค้าอื่นๆ</span>
            </div>
            {otherEnabled && (
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">แหล่งที่มา</p>
                  <div className="flex gap-4">
                    {[
                      { value: 'store',     label: 'หน้าร้าน'  },
                      { value: 'pre_order', label: 'Pre-order' },
                    ].map(s => (
                      <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input {...register('other.source')} type="radio" value={s.value} className="accent-slate-900" />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                {showOtherBarcode ? (
                  <ProductSearchField
                    itemBase="other"
                    fieldName="other.barcode"
                    priceBase="price_other"
                    control={control}
                    setValue={setValue}
                    products={products}
                  />
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Pre-order — จะบันทึกต้นทุนและรับสินค้าในภายหลัง
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Pricing ───────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="font-medium text-slate-800 text-sm">ราคาสินค้า</span>
            </div>
            <div className="px-4 py-4">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="text-left pb-2 pr-4 font-medium sr-only">ประเภท</th>
                    <th className="text-left pb-2 pr-2 font-medium">ราคาเต็ม (฿)</th>
                    <th className="text-left pb-2 pr-2 font-medium">ราคาหลังลด (฿)</th>
                    <th className="text-left pb-2 font-medium w-20">ส่วนลด (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <PriceRow label="เลนส์"       fieldBase="price_lens"  disabled={!lensEnabled}  control={control} register={register} />
                  <PriceRow label="กรอบ"        fieldBase="price_frame" disabled={!frameEnabled} control={control} register={register} />
                  <PriceRow label="สินค้าอื่นๆ" fieldBase="price_other" disabled={!otherEnabled} control={control} register={register} />
                </tbody>
              </table>

              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 whitespace-nowrap w-36">ส่วนลดพิเศษ (฿)</label>
                  <input type="number" min={0}
                    {...register('special_discount', { valueAsNumber: true })}
                    className={`w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                      errors.special_discount || serverError('special_discount') ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    placeholder="0" />
                  <span className="text-xs text-slate-400">หักจากยอดรวม</span>
                </div>
                {(errors.special_discount?.message || serverError('special_discount')) && (
                  <p className="text-xs text-red-500">{errors.special_discount?.message || serverError('special_discount')}</p>
                )}
                <TotalDisplay
                  control={control}
                  lensEnabled={lensEnabled}
                  frameEnabled={frameEnabled}
                  otherEnabled={otherEnabled}
                />
              </div>
            </div>
          </div>

          {/* ── Pickup ────────────────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-sm font-medium text-slate-700 mb-3">นัดรับสินค้า</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">วันที่</label>
                <input type="date" {...register('pickup_date')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.pickup_date || serverError('pickup_date') ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`} />
                {(errors.pickup_date?.message || serverError('pickup_date')) && (
                  <p className="text-xs text-red-500 mt-1">{errors.pickup_date?.message || serverError('pickup_date')}</p>
                )}
              </div>
              <div className="w-36">
                <label className="block text-xs text-slate-500 mb-1">เวลา</label>
                <input type="time" {...register('pickup_time')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    errors.pickup_time || serverError('pickup_time') ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`} />
                {(errors.pickup_time?.message || serverError('pickup_time')) && (
                  <p className="text-xs text-red-500 mt-1">{errors.pickup_time?.message || serverError('pickup_time')}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Initial Payment (new purchases only) ──────────────── */}
          {!initial && (
            <PaymentSection
              control={control}
              register={register}
              lensEnabled={lensEnabled}
              frameEnabled={frameEnabled}
              otherEnabled={otherEnabled}
              paymentAmountError={errors.payment_amount?.message || serverError('payment_amount')}
              paymentDateError={errors.payment_date?.message || serverError('payment_date')}
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose}
              disabled={submitting}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit"
              disabled={submitting}
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {submitting ? 'กำลังบันทึก...' : initial ? 'บันทึกการแก้ไข' : 'บันทึกการซื้อ'}
            </button>
          </div>
        </form>
      </div>
      {stockWarnings.length > 0 && pendingSubmit && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Stock ไม่พอสำหรับรายการนี้</h3>
                <p className="text-xs text-amber-700 mt-0.5">ตรวจสอบก่อนยืนยัน ระบบจะขายต่อและทำให้ stock ติดลบ</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              {stockWarnings.map((w, i) => (
                <div key={`${w.kind}-${w.identifier}-${i}`} className="border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{w.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{w.label} · {w.identifier}</p>
                    </div>
                    <span className="text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-1 shrink-0">
                      หลังขาย {w.after_stock}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-slate-50 rounded-lg py-2">
                      <p className="text-[10px] text-slate-400">คงเหลือ</p>
                      <p className="text-sm font-semibold text-slate-700">{w.current_stock}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <p className="text-[10px] text-slate-400">ต้องตัด</p>
                      <p className="text-sm font-semibold text-slate-700">{w.requested_qty}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg py-2">
                      <p className="text-[10px] text-red-400">ผลลัพธ์</p>
                      <p className="text-sm font-semibold text-red-600">{w.after_stock}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setStockWarnings([]); setPendingSubmit(null) }}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                กลับไปแก้ไข
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmStockOverride}
                className="flex-1 bg-amber-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'กำลังยืนยัน...' : 'ยืนยันขายต่อ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
