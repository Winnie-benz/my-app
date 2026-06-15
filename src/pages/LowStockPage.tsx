import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useProductStore } from '../store/useProductStore'
import { CategoryBadge } from '../components/Badge'
import { api } from '../services/api'

interface ZeroVariant {
  id: number
  product_id: number
  sku: string
  sph: string
  cyl: string
  stock_qty: number
  brand: string
  series: string
  lens_type: string
  lens_index: string
  coating: string
}

export default function LowStockPage() {
  const navigate = useNavigate()
  const products = useProductStore(s => s.products)
  const lowStockItems = products.filter(p => p.stock_current <= (p.reorder_point ?? 1))

  const [zeroVariants, setZeroVariants] = useState<ZeroVariant[]>([])

  useEffect(() => {
    api.lensProducts.zeroStock().then(r => setZeroVariants(r.data)).catch(() => {})
  }, [])

  const totalAlerts = lowStockItems.length + zeroVariants.length

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/stock')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex-1">
          <h1 className="text-base font-semibold text-slate-900">Low Stock</h1>
          <p className="text-xs text-slate-400">สินค้าที่ stock ต่ำกว่า reorder point และเลนส์ที่หมดสต็อก</p>
        </div>
        {totalAlerts > 0 && (
          <span className="bg-amber-100 text-amber-600 text-xs font-semibold px-3 py-1 rounded-full">
            {totalAlerts} {totalAlerts === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {totalAlerts === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-slate-700">All products are well-stocked</p>
          <p className="text-xs text-slate-400 mt-1">ทุกสินค้า stock เพียงพอ</p>
        </div>
      ) : (
        <>
          {/* Regular products section */}
          {lowStockItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">สินค้าทั่วไป</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Name', 'Barcode', 'Category', 'Stock'].map(h => (
                        <th
                          key={h}
                          className={`text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 ${
                            h === 'Stock' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/products/${p.id}`)}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg tracking-widest">
                            {p.barcode}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <CategoryBadge category={p.category} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums px-3 py-1.5 rounded-xl ${
                              p.stock_current === 0
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}
                          >
                            {p.stock_current === 0 ? 'Out' : `▲ ${p.stock_current}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lens variants section */}
          {zeroVariants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">เลนส์ (หมดสต็อก)</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['สินค้า', 'SPH / CYL', 'SKU', 'Stock'].map(h => (
                        <th
                          key={h}
                          className={`text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 ${
                            h === 'Stock' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zeroVariants.map(v => (
                      <tr
                        key={v.id}
                        onClick={() => navigate('/lens-products')}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-800">{v.brand} {v.series}</p>
                          <p className="text-xs text-slate-400">{v.lens_type} {v.lens_index} {v.coating}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-slate-700">
                            {v.sph} / {v.cyl}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg tracking-widest">
                            {v.sku || '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums px-3 py-1.5 rounded-xl bg-red-100 text-red-600">
                            Out
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
