import { useNavigate } from 'react-router-dom'
import { Plus, ScanLine, AlertTriangle, Search, X, ArrowUp } from 'lucide-react'
import { useProductStore } from '../store/useProductStore'
import { useStockFilter } from '../hooks/useStockFilter'
import { CATEGORIES } from '../types/product'
import StockTable from '../components/StockTable'
import ProductForm from '../components/ProductForm'
import StockMovementModal from '../components/StockMovementModal'

export default function StockPage() {
  const navigate = useNavigate()
  const {
    products,
    addProduct, updateProduct, deleteProduct, stockIn, stockOut,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    modal, setModal,
  } = useProductStore()

  const filtered = useStockFilter()

  const totalItems  = products.length
  const lowStock    = products.filter(p => p.stock_current <= (p.reorder_point ?? 1)).length
  const outOfStock  = products.filter(p => p.stock_current === 0).length
  const totalValue  = products.reduce((s, p) => s + p.avg_cost * p.stock_current, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Products</p>
          <p className="text-2xl font-semibold mt-1 text-slate-800">{totalItems}</p>
        </div>

        <button
          onClick={() => navigate('/low-stock')}
          className={`group relative bg-white border rounded-2xl px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
            lowStock > 0
              ? 'border-amber-200 hover:border-amber-400'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-amber-500">Low Stock</p>
          <p className={`text-2xl font-semibold mt-1 ${lowStock > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
            {lowStock}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">items ≤ 1</p>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-amber-400 transition-colors">
            →
          </span>
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Out of Stock</p>
          <p className={`text-2xl font-semibold mt-1 ${outOfStock > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {outOfStock}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Stock Value</p>
          <p className="text-2xl font-semibold mt-1 text-slate-800">
            ฿{totalValue.toLocaleString('th', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search barcode or name..."
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {['All', ...CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-4 py-2.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                categoryFilter === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/stock-check')}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:border-slate-400 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <ScanLine size={14} /> Stock Check
          </button>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>Showing {filtered.length} of {products.length} products</span>
        {(search || categoryFilter !== 'All') && (
          <button
            onClick={() => { setSearch(''); setCategoryFilter('All') }}
            className="underline hover:text-slate-600 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Product table */}
      <StockTable products={filtered} />

      {/* ── Modals ─────────────────────────────────────────────── */}

      {/* Add / Edit */}
      {(modal.mode === 'add' || modal.mode === 'edit') && (
        <ProductForm
          initial={modal.mode === 'edit' ? modal.product : null}
          onSave={data =>
            modal.mode === 'edit' ? updateProduct(modal.product.id, data) : addProduct(data)
          }
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}

      {/* Delete confirm */}
      {modal.mode === 'delete' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h2 className="font-semibold text-slate-900">Delete Product?</h2>
            <p className="text-sm text-slate-500 mt-1">{modal.product.name}</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setModal({ mode: 'closed' })}
                className="flex-1 border border-slate-200 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProduct(modal.product.id)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2.5 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock-in notice (barcode already existed) */}
      {modal.mode === 'stock-in-notice' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowUp size={24} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-slate-900 text-center">Barcode already exists</h2>
            <p className="text-sm text-slate-500 text-center mt-1 mb-4">
              Treated as <strong>Stock IN</strong> for {modal.product.name}
            </p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm mb-5">
              <div className="flex justify-between text-slate-600">
                <span>Added</span>
                <span className="font-semibold text-emerald-600">+{modal.added} units</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>New stock</span>
                <span className="font-semibold">{modal.product.stock_current + modal.added}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>New avg cost</span>
                <span className="font-semibold">฿{modal.newAvg.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setModal({ mode: 'closed' })}
              className="w-full bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Stock In / Stock Out */}
      {(modal.mode === 'stock-in' || modal.mode === 'stock-out') && (
        <StockMovementModal
          mode={modal.mode}
          product={modal.product}
          onConfirm={(qty, cost) => {
            if (modal.mode === 'stock-in') stockIn(modal.product.id, qty, cost)
            else stockOut(modal.product.id, qty, cost)
          }}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}
    </div>
  )
}
