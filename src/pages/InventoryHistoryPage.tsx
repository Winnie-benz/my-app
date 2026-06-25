import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, Search, Printer, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import type { InventorySession } from '../types/product'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePagedList } from '../hooks/usePagedList'
import Pagination from '../components/Pagination'

export default function InventoryHistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions]       = useState<InventorySession[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [from, setFrom]               = useState('')
  const [to, setTo]                   = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleting, setDeleting]       = useState(false)

  useEscapeKey(useCallback(() => setConfirmDelete(null), []), confirmDelete !== null)

  const { page, setPage, totalPages, total, pageItems } = usePagedList(sessions, 20)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    setLoading(true)
    try {
      const res = await api.inventory.listSessions({ search: search || undefined, from: from || undefined, to: to || undefined })
      setSessions(res.data)
    } catch { /* empty */ } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchSessions()
  }

  async function handleDelete() {
    if (confirmDelete === null) return
    setDeleting(true)
    try {
      await api.inventory.deleteSession(confirmDelete)
      setSessions(prev => prev.filter(s => s.id !== confirmDelete))
    } catch { /* empty */ } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <History size={20} className="text-slate-700" />
        <h1 className="text-xl font-semibold text-slate-900">ประวัติการตรวจนับสต็อก</h1>
      </div>

      {/* Search / filter */}
      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเลขที่หรือชื่อผู้ตรวจนับ..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">จาก</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">ถึง</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <button type="submit"
          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">
          ค้นหา
        </button>
        {(search || from || to) && (
          <button type="button" onClick={() => { setSearch(''); setFrom(''); setTo(''); fetchSessions() }}
            className="text-sm text-slate-400 hover:text-slate-700 px-2 py-2">
            ล้าง
          </button>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-16">กำลังโหลด...</p>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Printer size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">ยังไม่มีประวัติการตรวจนับ</p>
          <button type="button" onClick={() => navigate('/stock-check')}
            className="mt-3 text-sm text-slate-700 underline">
            ไปยังหน้าตรวจนับ
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Session #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">วันที่</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ผู้ตรวจนับ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">OK</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Missing</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Over</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/inventory-history/${s.id}`)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                        #{s.id}
                      </span>
                      {s.session_type === 'lens' && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md">
                          เลนส์
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-700 text-xs">
                    {new Date(s.created_at).toLocaleString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{s.created_by || '—'}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-700">{s.total_items}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-semibold text-emerald-600">{s.total_ok}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-semibold text-amber-600">{s.total_missing}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-semibold text-red-600">{s.total_over}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setConfirmDelete(s.id) }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบ session นี้"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-600">
              ลบประวัติการตรวจนับ <span className="font-mono font-bold">#{confirmDelete}</span> ออกจากระบบ? ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                ยกเลิก
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
