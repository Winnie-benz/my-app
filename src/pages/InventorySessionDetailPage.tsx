import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '../services/api'
import type { InventorySessionDetail } from '../types/product'
import { printInventoryReport } from '../utils/printInventoryReport'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ok:        { label: 'OK',        cls: 'bg-emerald-100 text-emerald-700' },
  missing:   { label: 'Missing',   cls: 'bg-amber-100 text-amber-700'    },
  over:      { label: 'Over',      cls: 'bg-red-100 text-red-600'        },
  unchecked: { label: 'Unchecked', cls: 'bg-slate-100 text-slate-400'    },
}

export default function InventorySessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<InventorySessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.inventory.getSession(Number(id))
      .then(res => setSession(res.data))
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [id])

  function handlePrint() {
    if (!session) return
    printInventoryReport(session, session.items)
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-400 text-center py-16">กำลังโหลด...</div>
  }

  if (!session) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-16">
        <p className="text-slate-500 text-sm">ไม่พบข้อมูล Session</p>
        <button type="button" onClick={() => navigate('/inventory-history')}
          className="mt-3 text-sm text-slate-700 underline">
          กลับหน้าประวัติ
        </button>
      </div>
    )
  }

  const dateStr = new Date(session.created_at).toLocaleString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const total_unchecked = session.total_items - session.total_ok - session.total_missing - session.total_over

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate('/inventory-history')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={15} />
          ประวัติการตรวจนับ
        </button>
        <button type="button" onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Printer size={14} />
          Export PDF
        </button>
      </div>

      {/* Session header */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-lg">Session #{session.id}</p>
            <p className="text-slate-400 text-sm mt-0.5">{dateStr}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">ผู้ตรวจนับ</p>
            <p className="text-white font-medium">{session.created_by || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100">
          {[
            { label: 'Total',   val: session.total_items,   color: 'text-slate-900'   },
            { label: 'OK',      val: session.total_ok,      color: 'text-emerald-600' },
            { label: 'Missing', val: session.total_missing, color: 'text-amber-600'   },
            { label: 'Over',    val: session.total_over,    color: 'text-red-600'     },
          ].map(item => (
            <div key={item.label} className="px-5 py-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`font-semibold text-2xl mt-0.5 ${item.color}`}>{item.val}</p>
            </div>
          ))}
        </div>

        {total_unchecked > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
            <p className="text-xs text-amber-700">
              มีสินค้า {total_unchecked} รายการที่ไม่ได้ตรวจนับในเซสชันนี้
            </p>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Barcode</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ชื่อสินค้า</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">คาดการณ์</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">นับได้</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ผลต่าง</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {session.items.map(item => {
              const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.unchecked
              const diff = item.difference
              return (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg tracking-widest">
                      {item.barcode}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">{item.sku || '—'}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{item.product_name}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{item.expected_qty}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{item.counted_qty}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                    {diff === 0 ? (
                      <span className="text-emerald-600">—</span>
                    ) : (
                      <span className={diff < 0 ? 'text-amber-600' : 'text-red-600'}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
