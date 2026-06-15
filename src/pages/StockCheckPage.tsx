import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw, ScanLine, Edit, ClipboardCheck, Printer, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProductStore } from '../store/useProductStore'
import { useAuthStore } from '../store/useAuthStore'
import type { CheckStatus, InventorySession } from '../types/product'
import { printInventoryReport } from '../utils/printInventoryReport'

const STATUS_CFG: Record<
  CheckStatus,
  { label: string; rowCls: string; badgeCls: string; icon: string }
> = {
  ok:        { label: 'OK',        rowCls: 'bg-emerald-50/50', badgeCls: 'bg-emerald-100 text-emerald-700', icon: '✔' },
  missing:   { label: 'Missing',   rowCls: 'bg-amber-50/40',   badgeCls: 'bg-amber-100 text-amber-700',    icon: '⚠' },
  over:      { label: 'Over',      rowCls: 'bg-red-50/40',     badgeCls: 'bg-red-100 text-red-600',        icon: '↺' },
  unchecked: { label: 'Unchecked', rowCls: '',                  badgeCls: 'bg-slate-100 text-slate-400',   icon: '○' },
}

const STATUS_SORT: Record<CheckStatus, number> = {
  missing: 0, over: 1, unchecked: 2, ok: 3,
}

type Alert = { msg: string; ok: boolean }
type SubmitState = 'idle' | 'confirming' | 'submitting' | 'done'

export default function StockCheckPage() {
  const navigate = useNavigate()
  const { checkEntries, initCheckEntries, processCount, resetCheck, submitCheck } = useProductStore()
  const user = useAuthStore(s => s.user)

  const [barcode, setBarcode]         = useState('')
  const [qty, setQty]                 = useState(1)
  const [scannerMode, setScannerMode] = useState(true)
  const [alert, setAlert]             = useState<Alert | null>(null)
  const [search, setSearch]           = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [session, setSession]         = useState<InventorySession | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkEntries.length === 0) initCheckEntries()
  }, [checkEntries.length, initCheckEntries])

  useEffect(() => { barcodeRef.current?.focus() }, [])

  const handleCount = useCallback(
    (bc: string, count: number) => {
      const result = processCount(bc.trim(), count)
      if (!result.productName) {
        setAlert({ msg: `Barcode ${bc} not found in product list`, ok: false })
      } else if (result.warning) {
        setAlert({ msg: `⚠ Over-scan: "${result.productName}". Count reset to 0. Please recount.`, ok: false })
      } else {
        setAlert({
          msg: `✓ ${result.productName}: ${result.finalCounted ?? 0} / ${result.expected ?? 0}`,
          ok: true,
        })
      }
    },
    [processCount],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!barcode.trim()) return
    handleCount(barcode.trim(), scannerMode ? 1 : qty || 1)
    setBarcode('')
    setQty(1)
    barcodeRef.current?.focus()
  }

  useEffect(() => {
    if (scannerMode && /^\d{7}$/.test(barcode)) {
      handleCount(barcode, 1)
      setBarcode('')
    }
  }, [barcode, scannerMode, handleCount])

  function handleReset() {
    resetCheck()
    setAlert(null)
    setSubmitState('idle')
    setSession(null)
    barcodeRef.current?.focus()
  }

  async function handleConfirmSubmit() {
    setSubmitState('submitting')
    const createdBy = user?.nickname || user?.first_name || 'Unknown'
    const result = await submitCheck(createdBy)
    if (result) {
      setSession(result)
      setSubmitState('done')
    } else {
      setSubmitState('idle')
      setAlert({ msg: 'เกิดข้อผิดพลาด ไม่สามารถบันทึกได้', ok: false })
    }
  }

  function handlePrintPDF() {
    if (!session) return
    const items = checkEntries.map(e => ({
      id: 0,
      session_id: session.id,
      product_id: e.product.id,
      barcode: e.product.barcode,
      sku: e.product.sku,
      product_name: e.product.name,
      expected_qty: e.expected,
      counted_qty: e.counted,
      difference: e.counted - e.expected,
      status: e.status,
    }))
    printInventoryReport(session, items)
  }

  const countOk        = checkEntries.filter(e => e.status === 'ok').length
  const countMissing   = checkEntries.filter(e => e.status === 'missing').length
  const countOver      = checkEntries.filter(e => e.status === 'over').length
  const countUnchecked = checkEntries.filter(e => e.status === 'unchecked').length

  const filtered = checkEntries
    .filter(e => {
      const q = search.toLowerCase()
      return !q || e.product.name.toLowerCase().includes(q) || e.product.barcode.includes(q)
    })
    .sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status])

  const isDone = submitState === 'done'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',     val: checkEntries.length, color: 'text-slate-800' },
          { label: 'OK ✔',      val: countOk,             color: 'text-emerald-600' },
          { label: 'Missing ⚠', val: countMissing,        color: 'text-amber-600'  },
          { label: 'Unchecked', val: countUnchecked,      color: 'text-slate-400'  },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Success banner */}
      {isDone && session && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-emerald-800">บันทึกการตรวจนับเรียบร้อย</p>
            <p className="text-sm text-emerald-600 mt-0.5">
              Session #{session.id} · OK {session.total_ok} · Missing {session.total_missing} · Over {session.total_over}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl transition-colors"
            >
              <Printer size={14} /> Export PDF
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory-history')}
              className="flex items-center gap-1.5 text-sm border border-emerald-300 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
            >
              <History size={14} /> ดูประวัติ
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors"
            >
              <RotateCcw size={14} /> เริ่มใหม่
            </button>
          </div>
        </div>
      )}

      {/* Scan panel */}
      {!isDone && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Scan / Input</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setScannerMode(m => !m); barcodeRef.current?.focus() }}
                className={`text-xs font-medium px-3.5 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
                  scannerMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {scannerMode ? <ScanLine size={12} /> : <Edit size={12} />}
                {scannerMode ? 'Scanner Mode' : 'Manual Mode'}
              </button>
              <button
                type="button"
                onClick={() => setSubmitState('confirming')}
                className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl transition-colors"
              >
                <ClipboardCheck size={12} /> Finalize
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-700 px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1">
              <input
                ref={barcodeRef}
                type="text"
                inputMode="numeric"
                value={barcode}
                onChange={e => setBarcode(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder={
                  scannerMode
                    ? 'Scan barcode (auto-detect 7 digits)...'
                    : 'Enter 7-digit barcode...'
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                autoComplete="off"
              />
            </div>
            {!scannerMode && (
              <>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                  placeholder="Qty"
                  className="w-20 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  Add Count
                </button>
              </>
            )}
          </form>
          {scannerMode && (
            <p className="text-xs text-slate-400 mt-2">
              Scanner mode: each scan adds +1. Full 7-digit code triggers automatically.
            </p>
          )}
        </div>
      )}

      {/* Alert toast */}
      {alert && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            alert.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}
        >
          {alert.msg}
        </div>
      )}

      {/* Search + history link */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm select-none">
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by barcode or name..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
        <button
          type="button"
          onClick={() => navigate('/inventory-history')}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-3.5 py-2.5 rounded-xl transition-colors"
        >
          <History size={13} /> ประวัติการตรวจนับ
        </button>
      </div>

      {/* Check table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Barcode', 'Name', 'Counted / Expected', 'Diff', 'Status'].map(h => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const cfg  = STATUS_CFG[e.status]
                const diff = e.counted - e.expected
                return (
                  <tr
                    key={e.product.id}
                    className={`border-b border-slate-100 last:border-0 ${cfg.rowCls}`}
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg tracking-widest">
                        {e.product.barcode}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{e.product.name}</p>
                      <p className="text-xs text-slate-400">{e.product.category}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-semibold text-slate-800">{e.counted}</span>
                        <span className="text-slate-400">/</span>
                        <span className="tabular-nums text-slate-500">{e.expected}</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              e.status === 'ok'      ? 'bg-emerald-400'
                              : e.status === 'missing' ? 'bg-amber-400'
                              : e.status === 'over'    ? 'bg-red-400'
                              : 'bg-slate-200'
                            }`}
                            style={{
                              width:
                                e.expected === 0
                                  ? '0%'
                                  : `${Math.min((e.counted / e.expected) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 tabular-nums font-semibold">
                      {e.status === 'unchecked' ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={diff < 0 ? 'text-amber-600' : diff > 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm submit modal */}
      {submitState === 'confirming' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-emerald-600" />
              <h3 className="font-semibold text-slate-900">ยืนยันการปิดการตรวจนับ</h3>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">รายการทั้งหมด</span>
                <span className="font-semibold">{checkEntries.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-600">OK</span>
                <span className="font-semibold text-emerald-600">{countOk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600">Missing</span>
                <span className="font-semibold text-amber-600">{countMissing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Over</span>
                <span className="font-semibold text-red-600">{countOver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unchecked</span>
                <span className="font-semibold text-slate-400">{countUnchecked}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              ระบบจะบันทึกผลการตรวจนับนี้เป็นประวัติถาวร และสามารถ Export PDF ได้ภายหลัง
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSubmitState('idle')}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={handleConfirmSubmit}
                className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-emerald-700 transition-colors">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting overlay */}
      {submitState === 'submitting' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 text-sm font-medium text-slate-700">
            กำลังบันทึก...
          </div>
        </div>
      )}
    </div>
  )
}
