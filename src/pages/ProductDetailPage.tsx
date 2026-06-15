import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, ArrowUp, ArrowDown, Printer } from 'lucide-react'
import { useProductStore } from '../store/useProductStore'
import { CategoryBadge, StockBadge } from '../components/Badge'
import ProductForm from '../components/ProductForm'
import StockMovementModal from '../components/StockMovementModal'
import { api } from '../services/api'
import { printBarcodeLabel } from '../utils/printBarcodeLabel'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { products, updateProduct, deleteProduct, stockIn, stockOut, modal, setModal } =
    useProductStore()

  const product = products.find(p => p.id === Number(id))
  const [movements, setMovements] = useState<any[]>([])
  const [labelQty, setLabelQty]   = useState(1)

  useEffect(() => {
    if (!product) return
    api.products.movements(product.id).then(res => setMovements(res.data)).catch(() => {})
  }, [product?.id])

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h2 className="text-lg font-semibold text-slate-800">Product not found</h2>
        <p className="text-sm text-slate-400 mt-1">ID #{id} does not exist in the inventory.</p>
        <Link
          to="/stock"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Stock
        </Link>
      </div>
    )
  }

  const margin =
    product.sell_price > 0
      ? Math.round(((product.sell_price - product.avg_cost) / product.sell_price) * 100)
      : 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/stock')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-slate-300">·</span>
        <span className="text-slate-400 truncate">{product.name}</span>
      </div>

      {/* Product card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <CategoryBadge category={product.category} />
              <StockBadge qty={product.stock_current} />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">{product.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span className="font-mono">{product.sku}</span>
              <span>·</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-lg tracking-widest">
                {product.barcode}
              </span>
            </div>
            {product.note && (
              <p className="text-sm text-slate-500 mt-2">{product.note}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {/* Print label */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => printBarcodeLabel(product, labelQty)}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:bg-slate-50 px-2.5 py-1.5 transition-colors"
              >
                <Printer size={12} /> Label
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <input
                type="number"
                min={1}
                max={100}
                value={labelQty}
                onChange={e => setLabelQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                aria-label="จำนวน label"
                className="w-10 text-center text-xs py-1.5 focus:outline-none bg-transparent text-slate-600"
              />
              <span className="text-xs text-slate-400 pr-2">ใบ</span>
            </div>
            <button
              type="button"
              onClick={() => setModal({ mode: 'edit', product })}
              className="flex items-center gap-1.5 text-xs border border-slate-200 hover:border-slate-400 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: 'delete', product })}
              className="flex items-center gap-1.5 text-xs border border-red-200 hover:border-red-400 text-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Stock</p>
          <p className="text-2xl font-semibold mt-1 text-slate-800">{product.stock_current}</p>
          <p className="text-xs text-slate-400">units</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sell Price</p>
          <p className="text-2xl font-semibold mt-1 text-slate-800">
            ฿{product.sell_price.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Avg Cost</p>
          <p className="text-2xl font-semibold mt-1 text-slate-800">
            ฿{product.avg_cost.toFixed(0)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Margin</p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              margin >= 40 ? 'text-emerald-600' : margin >= 20 ? 'text-amber-600' : 'text-red-500'
            }`}
          >
            {margin}%
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setModal({ mode: 'stock-in', product })}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-medium py-3 rounded-xl transition-colors"
          >
            <ArrowUp size={16} /> Stock In
          </button>
          <button
            onClick={() => setModal({ mode: 'stock-out', product })}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium py-3 rounded-xl transition-colors"
          >
            <ArrowDown size={16} /> Stock Out
          </button>
        </div>
      </div>

      {/* Movement history */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">ประวัติการเคลื่อนไหว</h2>
        </div>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีประวัติ</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {movements.map(m => {
              const isIn  = m.qty > 0
              const label = m.type === 'stock_in'  ? 'รับสินค้า'
                          : m.type === 'stock_out' ? 'นำออก (ปรับ)'
                          : 'ขาย'
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.created_at?.slice(0, 16).replace('T', ' ')}
                      {m.reference && <span className="ml-2 text-slate-300">#{m.reference}</span>}
                      {m.cost != null && m.type !== 'sale' && (
                        <span className="ml-2">ต้นทุน ฿{Number(m.cost).toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIn ? '+' : ''}{m.qty}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}

      {modal.mode === 'edit' && modal.product.id === product.id && (
        <ProductForm
          initial={product}
          onSave={data => updateProduct(product.id, data)}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}

      {modal.mode === 'delete' && modal.product.id === product.id && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <p className="text-4xl mb-4">🗑</p>
            <h2 className="font-semibold text-slate-900">Delete Product?</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">{product.name}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModal({ mode: 'closed' })}
                className="flex-1 border border-slate-200 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { deleteProduct(product.id); navigate('/stock') }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2.5 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(modal.mode === 'stock-in' || modal.mode === 'stock-out') &&
        modal.product.id === product.id && (
          <StockMovementModal
            mode={modal.mode}
            product={modal.product}
            onConfirm={(qty, cost) => {
              if (modal.mode === 'stock-in') stockIn(product.id, qty, cost)
              else stockOut(product.id, qty, cost)
            }}
            onClose={() => setModal({ mode: 'closed' })}
          />
        )}
    </div>
  )
}
