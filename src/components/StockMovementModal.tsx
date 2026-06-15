import { useState } from 'react'
import { X, ArrowUp, ArrowDown } from 'lucide-react'
import type { Product } from '../types/product'

type Props = {
  mode: 'stock-in' | 'stock-out'
  product: Product
  onConfirm: (qty: number, cost: number) => void
  onClose: () => void
}

export default function StockMovementModal({ mode, product, onConfirm, onClose }: Props) {
  const [qty, setQty] = useState(1)
  const [cost, setCost] = useState(product.cost_price)
  const isIn = mode === 'stock-in'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (qty <= 0) return
    onConfirm(qty, cost)
  }

  const afterStock = isIn ? product.stock_current + qty : Math.max(0, product.stock_current - qty)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIn ? 'bg-emerald-50' : 'bg-slate-100'}`}>
              {isIn
                ? <ArrowUp size={18} className="text-emerald-600" />
                : <ArrowDown size={18} className="text-slate-600" />}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{isIn ? 'Stock In' : 'Stock Out'}</h2>
              <p className="text-xs text-slate-400 truncate max-w-[160px]">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between text-sm">
            <span className="text-slate-500">Current Stock</span>
            <span className="font-semibold text-slate-800">{product.stock_current} units</span>
          </div>

          <div>
            <label htmlFor="movement-qty" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Quantity
            </label>
            <input
              id="movement-qty"
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="movement-cost" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Unit Cost (฿)
            </label>
            {!isIn && (
              <p className="text-xs text-slate-400 mb-1.5">ระบุต้นทุนเพื่อปรับ avg cost (กรณีแก้ไขข้อมูล)</p>
            )}
            <input
              id="movement-cost"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={e => setCost(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>

          <div className={`rounded-xl p-3 text-sm flex justify-between ${isIn ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
            <span className={isIn ? 'text-emerald-700' : 'text-amber-700'}>After this operation</span>
            <span className={`font-semibold ${isIn ? 'text-emerald-700' : 'text-amber-700'}`}>{afterStock} units</span>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 text-white text-sm font-medium py-2.5 rounded-xl transition-colors ${
                isIn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-700'
              }`}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
