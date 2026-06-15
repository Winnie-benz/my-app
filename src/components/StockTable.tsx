import { useNavigate } from 'react-router-dom'
import { Edit2, Trash2, ArrowUp, ArrowDown, Printer } from 'lucide-react'
import type { Product } from '../types/product'
import { CategoryBadge, StockBadge } from './Badge'
import { useProductStore } from '../store/useProductStore'
import { printBarcodeLabel } from '../utils/printBarcodeLabel'

type Props = { products: Product[] }

export default function StockTable({ products }: Props) {
  const navigate = useNavigate()
  const setModal = useProductStore(s => s.setModal)

  if (products.length === 0) {
    return (
      <div className="border border-slate-200 bg-white rounded-2xl flex flex-col items-center justify-center py-20">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-sm text-slate-500 font-medium">No products found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Barcode', 'SKU', 'Name', 'Category', 'Sell Price', 'Avg Cost', 'Stock', ''].map(h => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 last:text-right whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr
                key={p.id}
                onClick={() => navigate(`/products/${p.id}`)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 group transition-colors cursor-pointer"
              >
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg tracking-widest">
                    {p.barcode}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="font-mono text-xs text-slate-400">{p.sku}</span>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  {p.note && <p className="text-xs text-slate-400 mt-0.5">{p.note}</p>}
                </td>
                <td className="px-5 py-4">
                  <CategoryBadge category={p.category} />
                </td>
                <td className="px-5 py-4 font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                  ฿{p.sell_price.toLocaleString()}
                </td>
                <td className="px-5 py-4 tabular-nums">
                  <p className="text-slate-500">฿{p.avg_cost.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">
                    margin {p.sell_price > 0 ? Math.round(((p.sell_price - p.avg_cost) / p.sell_price) * 100) : 0}%
                  </p>
                </td>
                <td className="px-5 py-4">
                  <StockBadge qty={p.stock_current} />
                </td>
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="พิมพ์ label"
                      onClick={() => printBarcodeLabel(p, 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-violet-400 text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      <Printer size={13} />
                    </button>
                    <button
                      type="button"
                      title="Stock In"
                      onClick={() => setModal({ mode: 'stock-in', product: p })}
                      className="p-1.5 rounded-lg border border-emerald-200 hover:border-emerald-400 text-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      title="Stock Out"
                      onClick={() => setModal({ mode: 'stock-out', product: p })}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => setModal({ mode: 'edit', product: p })}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setModal({ mode: 'delete', product: p })}
                      className="p-1.5 rounded-lg border border-red-200 hover:border-red-400 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
