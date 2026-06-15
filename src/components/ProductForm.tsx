import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { X, Zap } from 'lucide-react'
import type { Product, ProductFormData, Category } from '../types/product'
import { CATEGORIES } from '../types/product'
import { generateBarcode } from '../utils/stockCalc'

const DEFAULT_VALUES: ProductFormData = {
  barcode: '',
  sku: '',
  name: '',
  category: 'กรอบ',
  cost_price: 0,
  sell_price: 0,
  stock_current: 0,
  note: '',
  reorder_point: 1,
}

type Props = {
  initial?: Product | null
  onSave: (data: ProductFormData) => void
  onClose: () => void
}

export default function ProductForm({ initial, onSave, onClose }: Props) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    defaultValues: initial
      ? {
          barcode:       initial.barcode,
          sku:           initial.sku,
          name:          initial.name,
          category:      initial.category,
          cost_price:    initial.cost_price,
          sell_price:    initial.sell_price,
          stock_current: initial.stock_current,
          note:          initial.note,
          reorder_point: initial.reorder_point ?? 1,
        }
      : DEFAULT_VALUES,
  })

  useEffect(() => {
    reset(
      initial
        ? {
            barcode:       initial.barcode,
            sku:           initial.sku,
            name:          initial.name,
            category:      initial.category,
            cost_price:    initial.cost_price,
            sell_price:    initial.sell_price,
            stock_current: initial.stock_current,
            note:          initial.note,
            reorder_point: initial.reorder_point ?? 1,
          }
        : DEFAULT_VALUES,
    )
  }, [initial, reset])

  const barcodeValue = watch('barcode')
  const isEdit = !!initial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit Product' : 'Add Product'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? `ID: ${initial.id} · ${initial.barcode}` : 'New item to inventory'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          id="product-form"
          onSubmit={handleSubmit(onSave)}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-4"
        >
          {/* Barcode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Barcode <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <Controller
                name="barcode"
                control={control}
                rules={{
                  required: 'Required',
                  pattern: { value: /^\d{7}$/, message: 'Must be exactly 7 digits' },
                }}
                render={({ field }) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="7-digit barcode"
                    {...field}
                    onChange={e => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    className={`flex-1 border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                      errors.barcode ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => setValue('barcode', generateBarcode(), { shouldValidate: true })}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <Zap size={12} /> Generate
              </button>
            </div>
            {errors.barcode && (
              <p className="text-xs text-red-400 mt-1">{errors.barcode.message}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {barcodeValue.length}/7 digits{barcodeValue.length === 7 && ' ✓'}
            </p>
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              SKU <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. FRAME-001"
              {...register('sku', { required: 'Required' })}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                errors.sku ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.sku && <p className="text-xs text-red-400 mt-1">{errors.sku.message}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Product Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Full product name"
              {...register('name', { required: 'Required' })}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => field.onChange(cat as Category)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-all ${
                        field.value === cat
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Cost Price (฿)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register('cost_price', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Cannot be negative' },
                })}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                  errors.cost_price ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {errors.cost_price && (
                <p className="text-xs text-red-400 mt-1">{errors.cost_price.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Sell Price (฿) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register('sell_price', {
                  valueAsNumber: true,
                  required: 'Required',
                  min: { value: 0.01, message: 'Must be > 0' },
                })}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                  errors.sell_price ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {errors.sell_price && (
                <p className="text-xs text-red-400 mt-1">{errors.sell_price.message}</p>
              )}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Stock (units)
            </label>
            <input
              type="number"
              min={0}
              {...register('stock_current', {
                valueAsNumber: true,
                min: { value: 0, message: 'Cannot be negative' },
              })}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all ${
                errors.stock_current ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.stock_current && (
              <p className="text-xs text-red-400 mt-1">{errors.stock_current.message}</p>
            )}
          </div>

          {/* Reorder Point */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Reorder Point (แจ้งเตือนเมื่อ stock ต่ำกว่า)
            </label>
            <input
              type="number"
              min={0}
              {...register('reorder_point', {
                valueAsNumber: true,
                min: { value: 0, message: 'Cannot be negative' },
              })}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">แจ้งเตือนเมื่อ stock เหลือน้อยกว่าหรือเท่ากับค่านี้</p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Note
            </label>
            <textarea
              rows={2}
              placeholder="Optional note..."
              {...register('note')}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            className="flex-1 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
