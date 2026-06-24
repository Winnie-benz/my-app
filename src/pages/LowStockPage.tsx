import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, EyeOff, Eye, ChevronDown, Trash2 } from 'lucide-react'
import { useProductStore } from '../store/useProductStore'
import type { Product } from '../types/product'
import { CategoryBadge } from '../components/Badge'
import { api } from '../services/api'
import { notify } from '../utils/notify'

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
  const fetchProducts = useProductStore(s => s.fetchProducts)
  const deleteProduct = useProductStore(s => s.deleteProduct)

  const lowStockItems = products.filter(p => p.stock_current <= (p.reorder_point ?? 1) && !p.low_stock_ignored)
  const ignoredProducts = products.filter(p => !!p.low_stock_ignored)

  const [zeroVariants, setZeroVariants] = useState<ZeroVariant[]>([])
  const [ignoredVariants, setIgnoredVariants] = useState<ZeroVariant[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  async function refreshVariants() {
    try {
      const [active, ignored] = await Promise.all([
        api.lensProducts.zeroStock(),
        api.lensProducts.zeroStockIgnored(),
      ])
      setZeroVariants(active.data)
      setIgnoredVariants(ignored.data)
    } catch {
      /* keep current view on transient errors */
    }
  }

  useEffect(() => {
    refreshVariants()
  }, [])

  async function setProductIgnored(id: number, ignored: boolean) {
    try {
      await api.products.ignoreLowStock(id, ignored)
      await fetchProducts()
    } catch {
      notify('error', ignored ? 'ซ่อนจากแจ้งเตือนไม่สำเร็จ' : 'เปิดแจ้งเตือนไม่สำเร็จ')
    }
  }

  async function setVariantIgnored(id: number, ignored: boolean) {
    try {
      await api.lensProducts.ignoreVariantLowStock(id, ignored)
      await refreshVariants()
    } catch {
      notify('error', ignored ? 'ซ่อนจากแจ้งเตือนไม่สำเร็จ' : 'เปิดแจ้งเตือนไม่สำเร็จ')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteProduct(deleteTarget.id)
    setDeleteTarget(null)
  }

  const totalAlerts = lowStockItems.length + zeroVariants.length
  const hiddenCount = ignoredProducts.length + ignoredVariants.length

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
                      <th className="w-20" />
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
                        <td className="px-2 py-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              title="ซ่อนจากแจ้งเตือน"
                              onClick={e => { e.stopPropagation(); setProductIgnored(p.id, true) }}
                              className="text-slate-300 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <EyeOff size={15} />
                            </button>
                            <button
                              type="button"
                              title="ลบสินค้า"
                              onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                              className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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
                      <th className="w-10" />
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
                        <td className="px-2 py-4 text-right">
                          <button
                            type="button"
                            title="ซ่อนจากแจ้งเตือน"
                            onClick={e => { e.stopPropagation(); setVariantIgnored(v.id, true) }}
                            className="text-slate-300 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <EyeOff size={15} />
                          </button>
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

      {/* Hidden-from-alert section */}
      {hiddenCount > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowHidden(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${showHidden ? '' : '-rotate-90'}`} />
            ซ่อนจากแจ้งเตือนแล้ว ({hiddenCount})
          </button>
          {showHidden && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {ignoredProducts.map(p => (
                <div key={`p-${p.id}`} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku} · คงเหลือ {p.stock_current}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setProductIgnored(p.id, false)}
                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <Eye size={14} /> เปิดแจ้งเตือน
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} /> ลบ
                    </button>
                  </div>
                </div>
              ))}
              {ignoredVariants.map(v => (
                <div key={`v-${v.id}`} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{v.brand} {v.series}</p>
                    <p className="text-xs text-slate-400">{v.sph} / {v.cyl} · {v.sku || '-'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVariantIgnored(v.id, false)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 shrink-0"
                  >
                    <Eye size={14} /> เปิดแจ้งเตือน
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900">ลบสินค้า</h3>
            <p className="text-sm text-slate-500 mt-2">
              ลบ <span className="font-medium text-slate-800">{deleteTarget.name}</span> ออกจากคลัง?
              จะหายจากแจ้งเตือนและคลังสินค้า แต่ยังกู้คืนได้ที่ ตั้งค่า → สินค้าที่ถูกลบ
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
